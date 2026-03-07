import os
import asyncio
from dotenv import load_dotenv

# Import the NvidiaTTSService which now handles simple TTS + Nvidia High Quality
from .nvidia_tts import NvidiaTTSService

load_dotenv()

class TTSService(NvidiaTTSService):
    """
    Wrapper for NvidiaTTSService to maintain backward compatibility.
    This ensures that anywhere TTSService is used, we now get the benefit
    of Nvidia TTS prioritization (for English) with Edge TTS fallback.
    """
    def __init__(self):
        super().__init__()
        print("🟢 Unified TTS Service initialized (Nvidia priority with Edge fallback).")

    async def generate_audio(self, text: str, language: str = "en", gender: str = "female") -> bytes:
        """
        Generate audio bytes.
        
        Args:
            text: Text to synthesize.
            language: Language code (e.g., "en", "en-US", "hi").
            gender: Voice gender preference (mapped to voice names in parent class).
        """
        # Map gender/generic voice requests to Nvidia personalities if strict mapping is needed,
        # otherwise NvidiaTTSService defaults to "mia" (female).
        voice = "mia" # Default Nvidia voice
        
        # Call the parent class's generate_audio
        # Parent signature: generate_audio(self, text: str, language: str = "en", voice: str = "mia")
        return await super().generate_audio(text, language, voice)
