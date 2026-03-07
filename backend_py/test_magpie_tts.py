import asyncio
import os
import sys
from pathlib import Path

# Add current directory to path so we can import services
sys.path.append(os.getcwd())

from services.nvidia_tts import NvidiaTTSService

async def test_multilingual_tts():
    service = NvidiaTTSService()
    
    test_cases = [
        ("en", "Hello, welcome to AgroTalk Assistant."),
        ("en", "I'm sorry to hear about the Ascochyta blight.")
    ]
    
    output_dir = Path("test_audio")
    output_dir.mkdir(exist_ok=True)
    
    print("🚀 Starting Multilingual TTS Test...")
    
    for lang, text in test_cases:
        print(f"Testing {lang} with '{text[:20]}...'")
        audio_data = await service.generate_audio(text, language=lang)
        
        if audio_data:
            safe_text = "".join(c for c in text[:10] if c.isalnum())
            file_path = output_dir / f"test_{lang}_{safe_text}.wav"
            with open(file_path, "wb") as f:
                f.write(audio_data)
            print(f"✅ Saved {file_path}")
        else:
            print(f"❌ Failed to generate audio for {lang}")

if __name__ == "__main__":
    asyncio.run(test_multilingual_tts())
