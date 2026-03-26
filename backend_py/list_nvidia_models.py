import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

async def list_models():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    url = "https://integrate.api.nvidia.com/v1/models"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    
    print(f"🚀 Listing models on {url}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                with open("nvidia_models.json", "w") as f:
                    json.dump(data, f, indent=2)
                print("✅ Full model list saved to nvidia_models.json")
                
                models = [m["id"] for m in data.get("data", [])]
                magpie_models = [m for m in models if "magpie" in m.lower()]
                
                print(f"✅ Found {len(models)} models total.")
                if magpie_models:
                    print("🎯 Magpie models found:")
                    for m in magpie_models:
                        print(f"  - {m}")
                else:
                    print("❌ No 'magpie' models found in the list.")
                    # Print first 10 models for context
                    print("Top 10 models:")
                    for m in models[:10]:
                        print(f"  - {m}")
            else:
                print(f"❌ Failed to list models: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(list_models())
