import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def discover_ai_endpoint():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    
    # Variations to test
    hosts = [
        "https://ai.api.nvidia.com/v1/audio",
        "https://integrate.api.nvidia.com/v1/audio"
    ]
    
    endpoints = [
        "/speech",
        "/nvidia/magpie-tts-multilingual",
        "/magpie-tts-multilingual"
    ]
    
    model_ids = [
        "nvidia/magpie-tts-multilingual",
        "magpie-tts-multilingual",
        "nvidia/magpie_tts_multilingual",
        "magpie_tts_multilingual"
    ]
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    
    payload_base = {
        "input": "Hello world",
        "voice": "aria"
    }

    async with httpx.AsyncClient() as client:
        for host in hosts:
            for ep in endpoints:
                url = host + ep
                print(f"\n🔍 Testing URL: {url}")
                
                # Test with and without model in payload
                for mid in [None] + model_ids:
                    payload = payload_base.copy()
                    if mid:
                        payload["model"] = mid
                        print(f"  - With model ID: {mid}")
                    else:
                        print(f"  - No model ID in payload")
                        
                    try:
                        response = await client.post(url, headers=headers, json=payload, timeout=5.0)
                        print(f"    Status: {response.status_code}")
                        if response.status_code == 200:
                            print(f"    ✅ SUCCESS! URL: {url}, Model: {mid}")
                            return
                        elif response.status_code != 404:
                            print(f"    Raw: {response.text[:100]}")
                    except Exception as e:
                        print(f"    Error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(discover_ai_endpoint())
