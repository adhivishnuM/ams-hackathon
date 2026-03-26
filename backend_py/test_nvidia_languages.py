"""Test NVIDIA TTS for all supported languages with the fixed language code handling."""
import os
import grpc
import riva.client
from dotenv import load_dotenv

load_dotenv()

# Language code mappings (same as nvidia_tts.py)
NVIDIA_LANG_CODE_MAP = {
    "en": "EN-US",
    "es": "es-US",
    "fr": "fr-FR",
    "de": "de-DE",
    "it": "it-IT",
    "pt": "pt-BR",
    "zh": "zh-CN",
    "vi": "vi-VN"
}

# Test phrases for each language
TEST_PHRASES = {
    "en": "Hello, how are you today?",
    "es": "Hola, ¿cómo estás hoy?",
    "fr": "Bonjour, comment allez-vous?",
    "de": "Hallo, wie geht es Ihnen?",
    "it": "Ciao, come stai oggi?",
    "pt": "Olá, como você está?",
    "zh": "你好，今天好吗？",
    "vi": "Xin chào, bạn khỏe không?"
}

def test_language(lang, phrase):
    print(f"\n[TESTING] Language: '{lang}' - {phrase[:30]}...")
    
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
    
    # Get locale from map
    locale = NVIDIA_LANG_CODE_MAP.get(lang, "EN-US")
    
    # Build voice name (uses uppercase locale)
    voice_name = f"Magpie-Multilingual.{locale}.Mia"
    
    # Fix language code (lowercase first part)
    parts = locale.split("-")
    if len(parts) == 2:
        language_code = f"{parts[0].lower()}-{parts[1].upper()}"
    else:
        language_code = locale.lower()
    
    print(f"    Voice: {voice_name}, Lang: {language_code}")
    
    try:
        resp = service.synthesize(
            text=phrase,
            voice_name=voice_name,
            language_code=language_code,
            sample_rate_hz=22050
        )
        print(f"[SUCCESS] Generated {len(resp.audio)} bytes ✅")
        return True
    except Exception as e:
        msg = str(e)
        if hasattr(e, 'details'):
            msg = e.details()
        print(f"[FAILED] {msg} ❌")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("NVIDIA TTS Language Test Suite (with fixed language codes)")
    print("=" * 60)
    
    results = {}
    for lang, phrase in TEST_PHRASES.items():
        results[lang] = test_language(lang, phrase)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    success = sum(1 for r in results.values() if r)
    total = len(results)
    print(f"\nPassed: {success}/{total} languages")
    
    for lang, passed in results.items():
        status = "✅" if passed else "❌"
        print(f"  {lang}: {status}")
