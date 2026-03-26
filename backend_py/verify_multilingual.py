import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from services.tts_service import TTSService

load_dotenv()

async def verify_multilingual():
    print("🚀 Verifying Multilingual TTS Support with Nvidia Priority...")
    tts = TTSService()
    
    test_cases = [
        {"lang": "en", "text": "Hello, I am your agricultural assistant. I am using Nvidia TTS for high quality English speech."},
        {"lang": "hi", "text": "नमस्ते, मैं आपका कृषि सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?"},
        {"lang": "mr", "text": "नमस्कार, मी तुमचा कृषी सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो?"},
        {"lang": "ta", "text": "வணக்கம், நான் உங்கள் விவசாய உதவியாளர். இன்று నేను మీకు ఎలా సహాయం చేయగలను?"},
        {"lang": "te", "text": "నమస్కారం, నేను మీ వ్యవసాయ సహాయకుడిని. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?"}
    ]
    
    for case in test_cases:
        lang = case["lang"]
        text = case["text"]
        print(f"\n🎤 Testing {lang}: {text[:30]}...")
        
        try:
            audio_data = await tts.generate_audio(text, language=lang)
            if audio_data:
                file_path = f"verify_{lang}.wav" if lang == "en" else f"verify_{lang}.mp3"
                with open(file_path, "wb") as f:
                    f.write(audio_data)
                print(f"✅ Success! Audio saved to {file_path} ({len(audio_data)} bytes)")
            else:
                print(f"❌ Failed to generate audio for {lang}")
        except Exception as e:
            print(f"❌ Error for {lang}: {e}")

if __name__ == "__main__":
    asyncio.run(verify_multilingual())
