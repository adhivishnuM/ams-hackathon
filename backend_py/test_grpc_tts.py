"""Test script for NVIDIA Magpie TTS via gRPC."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import riva.client

def test_grpc_tts():
    api_key = os.getenv("NVIDIA_TTS_KEY")
    function_id = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
    
    if not api_key:
        print("❌ NVIDIA_TTS_KEY not found in .env")
        return False
    
    print(f"🔑 API Key: {api_key[:20]}...")
    print(f"📌 Function ID: {function_id}")
    print(f"🌐 Server: grpc.nvcf.nvidia.com:443")
    print()
    
    # Create authenticated connection
    auth = riva.client.Auth(
        uri="grpc.nvcf.nvidia.com:443",
        use_ssl=True,
        metadata_args=[
            ["authorization", f"Bearer {api_key}"],
            ["function-id", function_id]
        ]
    )
    
    service = riva.client.SpeechSynthesisService(auth)
    
    # List voices first
    print("📋 Listing available voices...")
    try:
        config_response = service.stub.GetRivaSynthesisConfig(
            riva.client.proto.riva_tts_pb2.RivaSynthesisConfigRequest()
        )
        for model_config in config_response.model_config:
            lang = model_config.parameters.get('language_code', '?')
            voice = model_config.parameters.get('voice_name', '?')
            subvoices = model_config.parameters.get('subvoices', '')
            print(f"  [{lang}] {voice}: {subvoices[:60]}...")
        print()
    except Exception as e:
        print(f"⚠️ Could not list voices: {e}")
    
    # Generate test audio
    print("🎤 Generating test audio...")
    text = "Hello! This is a test of the NVIDIA Magpie Text to Speech service."
    voice_name = "Magpie-Multilingual.EN-US.Aria"
    
    try:
        resp = service.synthesize(
            text=text,
            voice_name=voice_name,
            language_code="en-US",
            sample_rate_hz=22050
        )
        
        import wave
        output_file = "test_grpc_output.wav"
        with wave.open(output_file, 'wb') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(22050)
            f.writeframes(resp.audio)
        
        print(f"✅ SUCCESS! Audio saved to {output_file} ({len(resp.audio)} bytes)")
        return True
        
    except Exception as e:
        error_msg = str(e)
        if hasattr(e, 'details'):
            error_msg = e.details()
        print(f"❌ FAILED: {error_msg}")
        return False

if __name__ == "__main__":
    test_grpc_tts()
