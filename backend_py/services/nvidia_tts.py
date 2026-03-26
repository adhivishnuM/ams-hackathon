import os
import wave
import io
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

# Force gRPC to use the OS native DNS resolver instead of c-ares,
# which intermittently times out on macOS despite the host being resolvable.
os.environ.setdefault("GRPC_DNS_RESOLVER", "native")
if not os.getenv("NVIDIA_TTS_KEY"):
    parent_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    if os.path.exists(parent_env):
        load_dotenv(parent_env)

try:
    import riva.client
    RIVA_AVAILABLE = True
except ImportError:
    RIVA_AVAILABLE = False
    print("❌ riva.client not installed — pip install nvidia-riva-client")

try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    print("⚠️ edge-tts not installed — pip install edge-tts")

_TTS_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="nvidia_tts")

# Only these voices are confirmed available on NVIDIA Magpie-Multilingual
NVIDIA_SUPPORTED_VOICES = {"mia", "aria", "sofia", "louise", "isabela"}

# Edge TTS voice map: Indian languages + English personality fallbacks
EDGE_VOICE_MAP = {
    # Indian language voices
    "ta": "ta-IN-PallaviNeural",
    "hi": "hi-IN-SwaraNeural",
    "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",
    # English personality → Edge TTS voice
    "mia": "en-US-AriaNeural",
    "aria": "en-US-AriaNeural",
    "sofia": "en-US-JennyNeural",
    "louise": "en-US-SaraNeural",
    "isabela": "en-US-JennyNeural",
}

# Keep old name for backward compat
EDGE_VOICES = EDGE_VOICE_MAP


class NvidiaTTSService:
    """NVIDIA Magpie TTS — persistent gRPC, 16kHz, auto-retry on DNS/connection errors."""

    def __init__(self):
        self.api_key = os.getenv("NVIDIA_TTS_KEY")
        self.fn_id   = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
        self.server  = "grpc.nvcf.nvidia.com:443"
        self._svc    = None

        if self.api_key and RIVA_AVAILABLE:
            self._connect()
        else:
            print("❌ NVIDIA_TTS_KEY missing or riva not installed")

    def _connect(self):
        try:
            auth = riva.client.Auth(
                uri=self.server,
                use_ssl=True,
                metadata_args=[
                    ["authorization", f"Bearer {self.api_key}"],
                    ["function-id", self.fn_id]
                ]
            )
            self._svc = riva.client.SpeechSynthesisService(auth)
            print("🟢 NVIDIA TTS ready (persistent gRPC)", flush=True)
        except Exception as e:
            print(f"❌ NVIDIA TTS connect failed: {e}", flush=True)
            self._svc = None

    def _voice_name(self, voice: str) -> str:
        v = voice.capitalize() if voice.lower() in VOICE_PERSONALITIES else "Mia"
        return f"Magpie-Multilingual.EN-US.{v}"

    def _call_grpc(self, text: str, voice_name: str) -> bytes:
        """Blocking gRPC synthesis — runs in thread pool. Always uses en-US language_code;
        Magpie auto-detects the text language from content."""
        t0 = time.monotonic()
        resp = self._svc.synthesize(
            text=text,
            voice_name=voice_name,
            language_code="en-US",
            sample_rate_hz=16000
        )
        elapsed = time.monotonic() - t0
        pcm = resp.audio
        print(f"  ⏱ gRPC: {elapsed:.2f}s | audio: {len(pcm)/32000:.1f}s | {len(pcm):,}B", flush=True)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(pcm)
        return buf.getvalue()

    async def _edge_tts(self, text: str, language: str, voice: str = "") -> Optional[bytes]:
        """Generate MP3 audio via Microsoft Edge TTS."""
        if not EDGE_TTS_AVAILABLE:
            print("❌ edge-tts not available", flush=True)
            return None
        # Resolve voice: check personality name first, then language code, then default
        resolved = EDGE_VOICE_MAP.get(voice.lower()) or EDGE_VOICE_MAP.get(language, "en-US-AriaNeural")
        print(f"🎤 [Edge TTS] lang={language} voice={resolved} {len(text)}chars", flush=True)
        voice = resolved
        try:
            t0 = time.monotonic()
            communicate = edge_tts.Communicate(text, voice)
            mp3_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_chunks.append(chunk["data"])
            mp3_bytes = b"".join(mp3_chunks)
            print(f"✅ [Edge TTS] {len(mp3_bytes):,} bytes in {time.monotonic()-t0:.2f}s", flush=True)
            return mp3_bytes
        except Exception as e:
            print(f"❌ [Edge TTS] {e}", flush=True)
            return None

    async def generate_audio(
        self,
        text: str,
        language: str = "en",
        voice: str = "mia",
        force_edge: bool = False
    ) -> Optional[bytes]:
        clean = text.strip()

        # Non-English, forced Edge, or voice not supported by NVIDIA → Edge TTS
        if language != "en" or force_edge or voice.lower() not in NVIDIA_SUPPORTED_VOICES:
            return await self._edge_tts(clean, language, voice)

        # English with supported NVIDIA voice: use NVIDIA Magpie gRPC
        if not self._svc:
            print("❌ NVIDIA TTS not connected, falling back to Edge TTS", flush=True)
            return await self._edge_tts(clean, language, voice)

        vname = self._voice_name(voice)
        print(f"🎤 [NVIDIA] {len(clean)}chars voice={vname}", flush=True)
        loop = asyncio.get_running_loop()

        try:
            t0 = time.monotonic()
            wav = await asyncio.wait_for(
                loop.run_in_executor(_TTS_EXECUTOR, self._call_grpc, clean, vname),
                timeout=15.0  # fail before Node's 20s abort
            )
            print(f"✅ [NVIDIA] {len(wav):,} bytes in {time.monotonic()-t0:.2f}s", flush=True)
            return wav

        except asyncio.TimeoutError:
            print("⏱️ [NVIDIA] Timeout — falling back to Edge TTS", flush=True)
            loop.run_in_executor(None, self._connect)
            return await self._edge_tts(clean, language, voice)

        except Exception as e:
            err = e.details() if hasattr(e, "details") else str(e)
            print(f"❌ [NVIDIA] {err} — falling back to Edge TTS", flush=True)
            loop.run_in_executor(None, self._connect)
            return await self._edge_tts(clean, language, voice)
