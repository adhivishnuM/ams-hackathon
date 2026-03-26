import asyncio
import os
import sys
from pathlib import Path

# Add current directory to path
sys.path.append(os.getcwd())

from services.nvidia_tts import NvidiaTTSService

async def test_fresh_en():
    service = NvidiaTTSService()
    text = "Hello, this is a clean test of the NVIDIA Magpie Multilingual TTS service."
    
    print("🚀 Starting English (General) Test...")
    audio_data = await service.generate_audio(text, language="en")
    
    if audio_data:
        file_path = "test_fresh_en.mp3"
        with open(file_path, "wb") as f:
            f.write(audio_data)
        print(f"✅ SUCCESS: Audio saved to {file_path} ({len(audio_data)} bytes)")
    else:
        print("❌ FAILED: Could not generate audio.")

if __name__ == "__main__":
    asyncio.run(test_fresh_en())
