import asyncio
import os
import sys

# Add backend_py to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend_py')))

from services.nvidia_vision import NvidiaVisionService

async def test_parsing():
    service = NvidiaVisionService()
    
    # Test Case 1: Mixed Language Dump (The reported issue)
    messy_text = """
    English:
    The plant is healthy.
    
    Hindi:
    पौधा स्वस्थ है.
    
    Tamil:
    தாவரம் ஆரோக்கியமானது.
    
    Telugu:
    మొక్క ఆరోగ్యంగా ఉంది.
    """
    
    # We pretend this came from the API when we asked for 'ta' (Tamil)
    print("Testing Tamil extraction from messy dump...")
    result_ta = service._smart_parse_text(messy_text, "ta")
    print(f"Extracted Description (Tamil): {result_ta['description']}")
    
    print("\nTesting Hindi extraction from messy dump...")
    result_hi = service._smart_parse_text(messy_text, "hi")
    print(f"Extracted Description (Hindi): {result_hi['description']}")

    # Test Case 2: Clean English
    clean_text = """
    **Crop Identified**: Tomato
    **Disease Name**: Early Blight
    **Description**: Fungal infection.
    """
    print("\nTesting Clean English...")
    result_en = service._smart_parse_text(clean_text, "en")
    print(f"Crop: {result_en['crop_identified']}")
    print(f"Disease: {result_en['disease_name']}")

if __name__ == "__main__":
    asyncio.run(test_parsing())
