import os
import wave
import io
import tempfile
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

# Try to import riva.client (may fail if not installed for Edge-only mode)
try:
    import riva.client
    RIVA_AVAILABLE = True
except ImportError:
    RIVA_AVAILABLE = False

# Try to import edge-tts for fallback
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

class NvidiaTTSService:
    """NVIDIA Magpie TTS service with Edge TTS fallback for unsupported languages."""
    
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_TTS_KEY")
        self.function_id = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
        self.server = "grpc.nvcf.nvidia.com:443"
        
        # NVIDIA Magpie Multilingual - Testing shows ONLY English is available
        # All other languages (Indian, European, Asian) fall back to Edge TTS
        self.NVIDIA_SUPPORTED_LANG_PREFIX = "en"
        
        # Language code to NVIDIA locale mapping (only English confirmed working)
        self.NVIDIA_LANG_CODE_MAP = {
            "en": "EN-US"
        }
        
        # Edge TTS voice mapping for ALL languages (especially Indian)
        self.EDGE_VOICE_MAP = {
            "en": "en-US-ChristopherNeural",
            "hi": "hi-IN-MadhurNeural",
            "ta": "ta-IN-ValluvarNeural",
            "te": "te-IN-MohanNeural",
            "mr": "mr-IN-ManoharNeural",
            "es": "es-US-AlonsoNeural",
            "fr": "fr-FR-HenriNeural",
            "de": "de-DE-ConradNeural",
            "it": "it-IT-DiegoNeural",
            "pt": "pt-BR-AntonioNeural",
            "zh": "zh-CN-YunxiNeural",
            "vi": "vi-VN-NamMinhNeural"
        }
        
        # Voice personality options (all female) for NVIDIA
        self.VOICE_PERSONALITIES = ["mia", "aria", "sofia", "louise", "isabela"]
        
        if self.api_key and RIVA_AVAILABLE:
            print(f"🟢 NVIDIA TTS Service initialized (gRPC) with Edge TTS fallback")
        elif EDGE_TTS_AVAILABLE:
            print("🟡 NVIDIA TTS unavailable. Using Edge TTS for all languages.")
        else:
            print("❌ No TTS service available. Please install edge-tts.")

    def _get_riva_service(self):
        """Create authenticated Riva TTS service."""
        if not RIVA_AVAILABLE:
            return None
        auth = riva.client.Auth(
            uri=self.server,
            use_ssl=True,
            metadata_args=[
                ["authorization", f"Bearer {self.api_key}"],
                ["function-id", self.function_id]
            ]
        )
        return riva.client.SpeechSynthesisService(auth)

    def _get_voice_name(self, language: str, voice: str = "mia") -> str:
        """Build NVIDIA voice name from language and voice personality."""
        locale = self.NVIDIA_LANG_CODE_MAP.get(language, "EN-US")
        voice_name = voice.capitalize() if voice.lower() in self.VOICE_PERSONALITIES else "Mia"
        return f"Magpie-Multilingual.{locale}.{voice_name}"

    async def _generate_edge_audio(self, text: str, language: str) -> Optional[bytes]:
        """Generate audio using Edge TTS (fallback for unsupported languages)."""
        if not EDGE_TTS_AVAILABLE:
            print("❌ Edge TTS not available. Cannot generate audio.")
            return None
        
        voice = self.EDGE_VOICE_MAP.get(language, "en-US-ChristopherNeural")
        print(f"🎤 [Edge TTS] Generating: '{text[:40]}...' ({language}, {voice})")
        
        try:
            communicate = edge_tts.Communicate(text, voice)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            await communicate.save(tmp_path)
            
            with open(tmp_path, "rb") as f:
                audio_data = f.read()
            
            os.unlink(tmp_path)
            print(f"✅ [Edge TTS] Generated {len(audio_data)} bytes of audio")
            return audio_data
        except Exception as e:
            print(f"❌ Edge TTS Error: {e}")
            return None

    async def _generate_nvidia_audio(self, text: str, language: str, voice: str) -> Optional[bytes]:
        """Generate audio using NVIDIA Magpie TTS via gRPC."""
        voice_name = self._get_voice_name(language, voice)
        # Get locale for voice name construction (e.g., "EN-US")
        locale = self.NVIDIA_LANG_CODE_MAP.get(language, "EN-US")
        
        # The API expects lowercase language codes (e.g., "en-US", "es-US")
        # but the voice name uses uppercase (e.g., "EN-US", "ES-US")
        # Convert the locale to proper casing: first part lowercase, second uppercase
        parts = locale.split("-")
        if len(parts) == 2:
            language_code = f"{parts[0].lower()}-{parts[1].upper()}"
        else:
            language_code = locale.lower()
            
        clean_text = str(text).strip()
        
        print(f"🎤 [NVIDIA gRPC] TTS for '{clean_text[:40]}...' (lang: {language_code}, voice: {voice_name})")
        
        try:
            service = self._get_riva_service()
            if not service:
                print("❌ NVIDIA Riva service not available.")
                return None
            
            resp = service.synthesize(
                text=clean_text,
                voice_name=voice_name,
                language_code=language_code,
                sample_rate_hz=22050
            )
            
            # Convert raw audio to WAV format
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(22050)
                wav_file.writeframes(resp.audio)
            
            wav_bytes = wav_buffer.getvalue()
            print(f"✅ [NVIDIA gRPC] Generated {len(wav_bytes)} bytes of audio")
            return wav_bytes
            
        except Exception as e:
            error_msg = str(e)
            if hasattr(e, 'details'):
                error_msg = e.details()
            print(f"❌ NVIDIA TTS Error: {error_msg}")
            return None

    async def generate_audio(self, text: str, language: str = "en", voice: str = "mia", force_edge: bool = False) -> Optional[bytes]:
        """
        Generates audio using NVIDIA TTS for supported languages (Western),
        or falls back to Edge TTS for unsupported languages (Indian).
        
        Args:
            text: Text to synthesize
            language: Language code (en, hi, ta, te, mr, es, fr, de, it, pt, zh, vi)
            voice: Voice personality (mia, aria, sofia) - only for NVIDIA
            force_edge: If True, bypass NVIDIA and use Edge TTS directly
            
        Returns:
            Audio bytes (WAV for NVIDIA, MP3 for Edge TTS), or None on failure.
        """
        lang = language.lower()
        
        # Check if language is supported by NVIDIA Magpie (English only)
        is_nvidia_supported = lang.startswith(self.NVIDIA_SUPPORTED_LANG_PREFIX)
        
        # Priotize NVIDIA for English even if force_edge is suggested (latest user preference)
        should_try_nvidia = is_nvidia_supported and self.api_key and RIVA_AVAILABLE
        
        if should_try_nvidia and (not force_edge or lang.startswith("en")):
            # Use NVIDIA TTS for supported Western languages
            audio = await self._generate_nvidia_audio(text, lang, voice)
            if audio:
                return audio
            # Fall back to Edge if NVIDIA fails
            print("⚠️ NVIDIA TTS failed. Falling back to Edge TTS...")
        else:
            if force_edge and not lang.startswith("en"):
                print(f"ℹ️ Forcing Edge TTS for language '{lang}' as requested...")
            elif not is_nvidia_supported:
                # Language not supported by NVIDIA (e.g., Hindi, Tamil, Telugu, Marathi)
                print(f"ℹ️ Language '{lang}' not supported by NVIDIA. Using Edge TTS...")
        
        # Fallback to Edge TTS
        return await self._generate_edge_audio(text, lang)

