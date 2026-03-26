import os
import tempfile
import subprocess
import asyncio
from typing import Optional
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

class NvidiaSTTService:
    """NVIDIA Whisper-large-v3 STT service using OpenAI-compatible API."""

    def __init__(self):
        # Prefer dedicated STT key, fallback to vision or generic API key
        self.api_key = os.getenv("NVIDIA_STT_KEY") or os.getenv("NVIDIA_VISION_KEY") or os.getenv("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.model = "nvidia/whisper-large-v3"
        
        self.client = None
        if self.api_key:
            self.client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key
            )
            print(f"🟢 NVIDIA STT Service initialized (OpenAI-compatible Whisper-large-v3)")
        else:
            print("⚠️ NVIDIA STT unavailable: API key missing.")

    def _convert_to_wav(self, input_path: str, output_path: str) -> bool:
        """Convert arbitrary audio to 16-bit Mono 16kHz WAV using ffmpeg."""
        try:
            cmd = [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ac", "1",          # Mono
                "-ar", "16000",      # 16kHz sample rate
                output_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except Exception as e:
            print(f"❌ [STT] FFmpeg conversion failed (ensure ffmpeg is installed): {e}")
            return False

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/ogg", language: str = "en") -> Optional[str]:
        """
        Transcribe audio bytes to text using NVIDIA Whisper API.
        """
        if not self.client:
            print("❌ [STT] No NVIDIA STT client available")
            return None

        ext_map = {
            "audio/ogg": ".ogg",
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/mp4": ".m4a",
            "audio/wav": ".wav",
            "audio/webm": ".webm",
            "audio/x-m4a": ".m4a"
        }
        ext = ext_map.get(mime_type, ".ogg")

        tmp_in = None
        tmp_wav = None
        try:
            # 1. Write the original bytes to a temp file
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_in = tmp.name
                
            # 2. Prepare temp path for WAV (Whisper likes WAV or MP3)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp2:
                tmp_wav = tmp2.name
                
            print(f"🎙️ [STT] Processing {len(audio_bytes)} bytes ({mime_type} -> WAV)...")
            
            # Convert audio
            if not self._convert_to_wav(tmp_in, tmp_wav):
                return None

            # 3. Call NVIDIA Whisper API
            print(f"🎙️ [STT] Calling NVIDIA Whisper API for {language}...")
            
            with open(tmp_wav, "rb") as audio_file:
                transcript = await self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="text",
                    language=language[:2] # 'en', 'hi', etc.
                )
            
            if transcript:
                print(f"✅ [STT] Transcript: '{transcript}'")
                return transcript
            else:
                print("❌ [STT] NVIDIA Whisper returned empty results")
                return None
            
        except Exception as e:
            print(f"❌ [STT] NVIDIA Whisper Error: {e}")
            return None
        finally:
            for p in [tmp_in, tmp_wav]:
                if p and os.path.exists(p):
                    try: os.unlink(p)
                    except: pass
