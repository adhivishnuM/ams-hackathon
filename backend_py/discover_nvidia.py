import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def discover():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    
    # Combinations to try
    tests = [
        ("https://integrate.api.nvidia.com/v1/audio/speech", "nvidia/magpie-tts-multilingual"),
        ("https://ai.api.nvidia.com/v1/audio/nvidia/magpie-tts-multilingual", None), # Direct NIM
        ("https://ai.api.nvidia.com/v1/audio/speech", "nvidia/magpie-tts-multilingual"),
    ]
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    
    for url, model in tests:
        print(f"\n>>> TESTING: URL={url}, MODEL={model} <<<")
        payload = {
            "input": "Hello",
            "voice": "aria"
        }
        if model:
            payload["model"] = model
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                print(f"  Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"  ✅ SUCCESS: Found working combination!")
                    print(f"  - URL: {url}")
                    print(f"  - MODEL: {model}")
                    return url
                else: 
                    print(f"  ❌ FAILED ({response.status_code})")
                    try:
                        err_data = response.json()
                        print(f"  Error Detail: {json.dumps(err_data)[:200]}")
                    except:
                        print(f"  Raw Error (first 100): {response.text[:100]}")
        except Exception as e:
            print(f"  ⚠️ EXCEPTION: {str(e)}")
    print("\n--- Discovery Finished: No success ---")
    return None

if __name__ == "__main__":
    asyncio.run(discover())
