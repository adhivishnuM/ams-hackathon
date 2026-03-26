import requests
import time
import sys

BASE_URL = "http://localhost:8000/api/plant"

def test_health():
    try:
        print("Testing /health...")
        res = requests.get(f"{BASE_URL}/health")
        if res.status_code == 200:
            print(f"✅ Health Check Passed: {res.json()}")
            return True
        else:
            print(f"❌ Health Check Failed: {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

def test_status():
    try:
        print("Testing /status...")
        res = requests.get(f"{BASE_URL}/status")
        if res.status_code == 200:
            print(f"✅ Status Check Passed: {res.json()}")
            return True
        else:
            print(f"❌ Status Check Failed: {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

def test_stream():
    try:
        print("Testing /feed (Stream)...")
        # Stream a few bytes
        res = requests.get(f"{BASE_URL}/feed", stream=True)
        if res.status_code == 200:
            print("✅ Stream Connection Established")
            chunk_count = 0
            for chunk in res.iter_content(chunk_size=1024):
                chunk_count += 1
                if chunk_count > 10:
                    print("✅ Received video chunks successfully")
                    break
            return True
        else:
            print(f"❌ Stream Failed: {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ Stream Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Verifying Plant Backend...")
    if test_health() and test_status():
        print("Backend logical endpoints are working.")
        # Note: Stream test might fail if camera is occupied or not present on server env
        # but we test it anyway
        test_stream()
    else:
        print("❌ Backend verification failed.")
        sys.exit(1)
