import sys
import asyncio
import os

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.nvidia_stt import NvidiaSTTService

async def main():
    service = NvidiaSTTService()
    if not service.client:
        print("Failed to init service")
        sys.exit(1)
        
    print("Service init successful!")
    sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())
