import os
import sys
from dotenv import load_dotenv

# Try to load from root .env
root_env = os.path.abspath(os.path.join(os.getcwd(), "..", ".env"))
print(f"Checking root .env at: {root_env}")
if os.path.exists(root_env):
    load_dotenv(root_env)
    print("✅ Root .env loaded")
else:
    print("❌ Root .env not found")

print(f"NVIDIA_TTS_KEY: {'[SET]' if os.getenv('NVIDIA_TTS_KEY') else '[MISSING]'}")

try:
    import riva.client
    print("✅ riva.client is installed")
except ImportError:
    print("❌ riva.client is NOT installed")

try:
    import edge_tts
    print("✅ edge-tts is installed")
except ImportError:
    print("❌ edge-tts is NOT installed")
