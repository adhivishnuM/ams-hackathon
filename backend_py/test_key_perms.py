import os
import base64
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def test_key_permissions():
    # Use the TTS key for a vision task to check if it's a valid catalog key
    api_key = os.getenv("NVIDIA_TTS_KEY")
    base_url = "https://integrate.api.nvidia.com/v1"
    
    client = OpenAI(
        base_url=base_url,
        api_key=api_key
    )
    
    dummy_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    
    print(f"🚀 Testing key permissions with vision model...")
    try:
        response = client.chat.completions.create(
            model="meta/llama-3.2-90b-vision-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is in this image?"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{dummy_image_b64}"},
                        },
                    ],
                }
            ],
            max_tokens=10
        )
        print(f"✅ Key is VALID. Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"❌ Key verification FAILED: {str(e)}")

if __name__ == "__main__":
    test_key_permissions()
