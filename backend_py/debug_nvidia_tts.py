import os
import sys
import grpc
import riva.client
from dotenv import load_dotenv

load_dotenv()

def test_config(voice_name, language_code, text="Hello world"):
    print(f"\n[TESTING] Voice: '{voice_name}', Lang: '{language_code}'")
    
    api_key = os.getenv("NVIDIA_TTS_KEY")
    function_id = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
    server = "grpc.nvcf.nvidia.com:443"
    
    auth = riva.client.Auth(
        uri=server,
        use_ssl=True,
        metadata_args=[
            ["authorization", f"Bearer {api_key}"],
            ["function-id", function_id]
        ]
    )
    service = riva.client.SpeechSynthesisService(auth)
    
    try:
        resp = service.synthesize(
            text=text,
            voice_name=voice_name,
            language_code=language_code,
            sample_rate_hz=22050
        )
        print(f"[SUCCESS] Generated {len(resp.audio)} bytes")
    except Exception as e:
        msg = str(e)
        if hasattr(e, 'details'):
            msg = e.details()
        print(f"[FAILED] {msg}")

if __name__ == "__main__":
    configs = [
        ("Magpie-Multilingual.EN-US.Mia", "EN-US"),
        ("Magpie-Multilingual.EN-US.Mia", "en-US"),
        ("English-US.Mia", "en-US"),
        ("Mia", "en-US"),
        ("Magpie-Multilingual.en-US.Mia", "en-US")
    ]
    
    print("Starting Debug Probe...")
    for voice, lang in configs:
        test_config(voice, lang)
