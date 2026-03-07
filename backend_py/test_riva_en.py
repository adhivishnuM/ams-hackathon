import os
import riva.client
from dotenv import load_dotenv

load_dotenv()

def test_riva_en():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    # For NVIDIA NVCF (Cloud Functions), the endpoint is typically this:
    uri = "grpc.nvcf.nvidia.com:443"
    
    print(f"🚀 Connecting to Riva gRPC at {uri}...")
    
    # Authenticate with Bearer token and function-id
    auth = riva.client.Auth(
        uri=uri,
        use_ssl=True,
        metadata_args=[
            ["authorization", f"Bearer {api_key}"],
            ["function-id", "ad7ec442-3309-4aef-a414-01c3ef1138817"]
        ]
    )
    
    service = riva.client.SpeechSynthesisService(auth)
    
    # Try to list voices first
    print("📋 Listing available voices...")
    try:
        import riva.client.proto.riva_tts_pb2 as riva_tts
        config_response = service.stub.GetRivaSynthesisConfig(riva_tts.RivaSynthesisConfigRequest())
        for model_config in config_response.model_config:
            print(f"Model: {model_config.model_name}")
            for key, value in model_config.parameters.items():
                print(f"  {key}: {value}")
    except Exception as e:
        print(f"⚠️ Could not list voices: {str(e)}")

    text = "Hello, this is a test of the NVIDIA Magpie Multilingual TTS service."
    language_code = "en-US"
    # Try a very generic voice name if listing fails
    voice_name = "aria" 
    
    print(f"🎤 Generating audio for: '{text}' ({language_code}) with voice '{voice_name}'...")
    
    try:
        resp = service.synthesize(
            text=text,
            language_code=language_code,
            voice_name=voice_name,
            sample_rate_hz=44100
        )
        
        output_file = "test_riva_en.wav"
        with open(output_file, "wb") as f:
            f.write(resp.audio)
        
        print(f"✅ SUCCESS: Audio saved to {output_file} ({len(resp.audio)} bytes)")
        
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        # Check if details available
        if hasattr(e, 'details'):
            print(f"Details: {e.details()}")

if __name__ == "__main__":
    test_riva_en()
