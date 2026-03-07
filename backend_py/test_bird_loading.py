import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.getcwd())

load_dotenv()

def test_bird_loading():
    print("📦 Testing Bird Detector Model Loading...")
    try:
        from detector import BirdDetector
        # The SSL fix is applied in main.py, so for this test script we apply it here too
        import ssl
        import certifi
        os.environ['SSL_CERT_FILE'] = certifi.where()
        ssl._create_default_https_context = ssl._create_unverified_context
        
        detector = BirdDetector(model_path="yolov8n.pt")
        print("✅ Bird Detector initialized successfully!")
        return True
    except Exception as e:
        print(f"❌ Bird Detector initialization failed: {e}")
        return False

if __name__ == "__main__":
    test_bird_loading()
