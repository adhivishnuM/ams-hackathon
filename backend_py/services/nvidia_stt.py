import os
import tempfile
import subprocess
import asyncio
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
# Also search parent directory for .env (if running from backend_py/)
if not os.getenv("NVIDIA_STT_KEY") and not os.getenv("NVIDIA_VISION_KEY") and not os.getenv("NVIDIA_API_KEY"):
    parent_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    if os.path.exists(parent_env):
        print(f"ℹ️ Loading .env from: {parent_env}")
        load_dotenv(parent_env)

try:
    import riva.client
    RIVA_AVAILABLE = True
except ImportError:
    RIVA_AVAILABLE = False


class NvidiaSTTService:
    """NVIDIA Whisper-large-v3 STT service using Riva gRPC."""

    def __init__(self):
        # Prefer dedicated STT key, fallback to vision or generic API key
        self.api_key = os.getenv("NVIDIA_STT_KEY") or os.getenv("NVIDIA_VISION_KEY") or os.getenv("NVIDIA_API_KEY")
        self.function_id = os.getenv("NVIDIA_STT_FUNCTION_ID", "b702f636-f60c-4a3d-a6f4-f3568c13bd7d")
        self.server = "grpc.nvcf.nvidia.com:443"
        
        self.auth = None
        if self.api_key and RIVA_AVAILABLE:
            self.auth = riva.client.Auth(
                uri=self.server,
                use_ssl=True,
                metadata_args=[
                    ["authorization", f"Bearer {self.api_key}"],
                    ["function-id", self.function_id]
                ]
            )
            print(f"🟢 NVIDIA STT Service initialized (Riva gRPC Whisper-large-v3)")
        else:
            if not RIVA_AVAILABLE:
                print("❌ NVIDIA STT unavailable: 'nvidia-riva-client' package not installed.")
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
            # Run silently
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except Exception as e:
            print(f"❌ [STT] FFmpeg conversion failed (ensure ffmpeg is installed): {e}")
            return False

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/ogg", language: str = "en") -> Optional[str]:
        """
        Transcribe audio bytes to text using NVIDIA Riva.
        
        Args:
            audio_bytes: Raw audio data
            mime_type: Mime type of the audio (e.g., 'audio/ogg', 'audio/mpeg')
            language: ISO language code (e.g., 'en', 'hi')
            
        Returns:
            Transcribed text string or None if failed.
        """
        if not self.auth:
            print("❌ [STT] No NVIDIA STT Riva auth available")
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
                
            # 2. Prepare temp path for WAV
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp2:
                tmp_wav = tmp2.name
                
            print(f"🎙️ [STT] Processing {len(audio_bytes)} bytes ({mime_type} -> WAV)...")
            
            # Convert audio
            if not self._convert_to_wav(tmp_in, tmp_wav):
                return None

            # 3. Read the converted WAV bytes
            with open(tmp_wav, "rb") as f:
                wav_data = f.read()

            # 4. Initialize Riva client
            asr_service = riva.client.ASRService(self.auth)
            
            # Map simple language codes like 'en' to Riva format 'en-US'
            lang_map = {
                "en": "en-US",
                "hi": "hi-IN",
                "ta": "ta-IN",
                "te": "te-IN",
                "mr": "mr-IN",
                "fr": "fr-FR",
                "es": "es-US",
            }
            language_code = lang_map.get(language[:2].lower(), "en-US")
            
            # 5. Configure Recognition
            config = riva.client.RecognitionConfig(
                encoding=riva.client.AudioEncoding.LINEAR_PCM,
                sample_rate_hertz=16000,
                audio_channel_count=1,
                language_code=language_code,
                max_alternatives=1,
                enable_automatic_punctuation=True,
            )

            # 6. Call Offline Recognize (run in thread pool to avoid blocking asyncio loop)
            print(f"🎙️ [STT] Calling Riva gRPC for {language_code}...")
            loop = asyncio.get_running_loop()
            
            def run_riva():
                return asr_service.offline_recognize(wav_data, config)
                
            response = await loop.run_in_executor(None, run_riva)
            
            if response and response.results:
                transcript = response.results[0].alternatives[0].transcript
                print(f"✅ [STT] Transcript: '{transcript}'")
                return transcript
            else:
                print("❌ [STT] NVIDIA Riva returned empty results")
                return None
            
        except Exception as e:
            print(f"❌ [STT] NVIDIA Riva Error: {e}")
            return None
        finally:
            if tmp_in and os.path.exists(tmp_in):
                try:
                    os.unlink(tmp_in)
                except Exception:
                    pass
            if tmp_wav and os.path.exists(tmp_wav):
                try:
                    os.unlink(tmp_wav)
                except Exception:
                    pass
