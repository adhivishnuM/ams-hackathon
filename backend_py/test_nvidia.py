import os
import sys
from services.nvidia_vision import NvidiaVisionService
import base64

def test():
    # Create a tiny dummy image (1x1 red dot)
    dummy_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    
    service = NvidiaVisionService()
    if not service.api_key:
        print("❌ Error: NVIDIA_API_KEY not found in .env")
        return

    print(f"Testing with key: {service.api_key[:5]}...{service.api_key[-5:]}")
    result = service.analyze_image(dummy_image_b64)
    print("Result:", result)

if __name__ == "__main__":
    # Add current dir to path to import services
    sys.path.append(os.getcwd())
    test()
