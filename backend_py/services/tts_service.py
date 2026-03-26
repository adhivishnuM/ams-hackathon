from .nvidia_tts import NvidiaTTSService
from typing import Optional

class TTSService(NvidiaTTSService):
    """Thin wrapper kept for backward compatibility."""
    def __init__(self):
        super().__init__()

    async def generate_audio(self, text: str, language: str = "en", voice: str = "mia", force_edge: bool = False) -> Optional[bytes]:
        return await super().generate_audio(text, language, voice, force_edge=force_edge)
