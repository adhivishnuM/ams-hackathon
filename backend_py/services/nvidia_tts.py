import os
import wave
import io
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from typing import Optional

load_dotenv()
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

_TTS_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="nvidia_tts")

VOICE_PERSONALITIES = ["mia", "aria", "sofia", "louise", "isabela"]

# Warmup phrase — sent once at startup to pre-warm NVIDIA's pipeline
_WARMUP_TEXT = "Hello, I am your agricultural assistant."


class NvidiaTTSService:
    """NVIDIA Magpie TTS — single-call synthesis, persistent gRPC, no fallback."""

    def __init__(self):
        self.api_key  = os.getenv("NVIDIA_TTS_KEY")
        self.fn_id    = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
        self.server   = "grpc.nvcf.nvidia.com:443"
        self._svc     = None

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
            # Fire warmup in background — warms NVIDIA's server pipeline for this API key
            _TTS_EXECUTOR.submit(self._warmup)
        except Exception as e:
            print(f"❌ NVIDIA TTS connect failed: {e}", flush=True)
            self._svc = None

    def _warmup(self):
        """Synchronous warmup — runs in thread pool during startup."""
        try:
            t0 = time.monotonic()
            resp = self._svc.synthesize(
                text=_WARMUP_TEXT,
                voice_name="Magpie-Multilingual.EN-US.Mia",
                language_code="en-US",
                sample_rate_hz=16000
            )
            elapsed = time.monotonic() - t0
            print(f"🔥 NVIDIA TTS warmup done in {elapsed:.1f}s ({len(resp.audio):,}B)", flush=True)
        except Exception as e:
            print(f"⚠️ NVIDIA TTS warmup failed (non-fatal): {e}", flush=True)

    def _voice_name(self, voice: str) -> str:
        v = voice.capitalize() if voice.lower() in VOICE_PERSONALITIES else "Mia"
        return f"Magpie-Multilingual.EN-US.{v}"

    def _call_grpc(self, text: str, voice_name: str) -> bytes:
        """Blocking gRPC synthesis → called via run_in_executor."""
        t0 = time.monotonic()
        resp = self._svc.synthesize(
            text=text,
            voice_name=voice_name,
            language_code="en-US",
            sample_rate_hz=16000
        )
        grpc_time = time.monotonic() - t0
        pcm = resp.audio
        dur_sec = len(pcm) / 32000
        print(f"  ⏱ gRPC: {grpc_time:.2f}s | audio: {dur_sec:.1f}s | {len(pcm):,}B PCM", flush=True)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(pcm)
        return buf.getvalue()

    async def generate_audio(
        self,
        text: str,
        language: str = "en",
        voice: str = "mia",
        force_edge: bool = False
    ) -> Optional[bytes]:
        if not self._svc:
            print("❌ NVIDIA TTS not connected", flush=True)
            return None

        clean = text.strip()
        vname = self._voice_name(voice)
        t0 = time.monotonic()
        print(f"🎤 [NVIDIA] {len(clean)}chars voice={vname}", flush=True)

        try:
            loop = asyncio.get_running_loop()
            wav = await asyncio.wait_for(
                loop.run_in_executor(_TTS_EXECUTOR, self._call_grpc, clean, vname),
                timeout=30.0
            )
            total = time.monotonic() - t0
            print(f"✅ [NVIDIA] {len(wav):,} bytes in {total:.2f}s total", flush=True)
            return wav

        except asyncio.TimeoutError:
            elapsed = time.monotonic() - t0
            print(f"⏱️ [NVIDIA] Timeout after {elapsed:.1f}s — reconnecting", flush=True)
            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, self._connect)
            return None
        except Exception as e:
            err = e.details() if hasattr(e, "details") else str(e)
            print(f"❌ [NVIDIA] {err}", flush=True)
            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, self._connect)
            return None
