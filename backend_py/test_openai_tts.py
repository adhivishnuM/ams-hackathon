import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def test_nvidia_openai_tts():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    base_url = "https://integrate.api.nvidia.com/v1"
    
    client = OpenAI(
        base_url=base_url,
        api_key=api_key
    )

    print(f"🚀 Testing OpenAI-compatible TTS for English...")
    try:
        response = client.audio.speech.create(
            model="nvidia/magpie-tts-multilingual",
            voice="aria",
            input="Hello, this is a test of the NVIDIA Magpie Multilingual TTS service."
        )
        
        # Save output
        output_file = "test_openai_en.mp3"
        response.stream_to_file(output_file)
        print(f"✅ SUCCESS: Audio saved to {output_file}")
        
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

if __name__ == "__main__":
    test_nvidia_openai_tts()
