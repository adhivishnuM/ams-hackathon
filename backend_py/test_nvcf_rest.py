import os
import requests
import json
import base64
from dotenv import load_dotenv

load_dotenv()

def test_nvcf_rest():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    function_id = os.getenv("NVIDIA_TTS_FUNCTION_ID")
    
    # Generic NVCF inference URL
    url = f"https://api.nvcf.nvidia.com/v2/nvcf/functions/{function_id}/infer"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    # Magpie TTS usually takes a JSON payload like this for REST
    payload = {
        "text": "Hello, this is a test of NVIDIA Magpie TTS via REST.",
        "language": "en-US",
        "voice": "Mia"
    }
    
    print(f"Testing NVCF REST: {url}")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Success!")
            data = response.json()
            # Often NVCF returns base64 audio in a 'audio' field or similar
            if 'audio' in data:
                print(f"Found audio data: {len(data['audio'])} bytes (base64)")
            else:
                print(f"Response keys: {data.keys()}")
        elif response.status_code == 202:
            print("🕒 Request accepted (polling required)")
            req_id = response.headers.get("NVCF-REQID")
            print(f"Request ID: {req_id}")
        else:
            print(f"❌ Failed: {response.text}")
    except Exception as e:
        print(f"⚠️ Error: {e}")

if __name__ == "__main__":
    test_nvcf_rest()
