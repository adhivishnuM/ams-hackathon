"""
AgroVoice Backend - Specialized Plant Disease Detection API
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.nvidia_tts import NvidiaTTSService
from services.nvidia_vision import NvidiaVisionService
from services.whatsapp_ai import WhatsAppAIService, build_image_reply, get_whatsapp_service
from bird_server import router as bird_router
import io
import base64
import ssl
import certifi

# Fix SSL certificate issues (common on macOS)
try:
    os.environ['SSL_CERT_FILE'] = certifi.where()
    ssl._create_default_https_context = ssl._create_unverified_context
    print("🔒 SSL Context initialized with certifi")
except Exception as e:
    print(f"⚠️ SSL Context initialization failed: {e}")

# Global services
nvidia_service: Optional[NvidiaVisionService] = None
tts_service: Optional[NvidiaTTSService] = None

# Simple in-memory cache for vision and TTS
vision_cache = {}
tts_cache = {}

class AnalyzeRequest(BaseModel):
    image: str
    cropType: Optional[str] = None
    language: Optional[str] = "en"

class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    voice: Optional[str] = "mia"
    force_edge: Optional[bool] = False

# WhatsApp Bridge Request Models
class WhatsAppChatRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

class WhatsAppImageRequest(BaseModel):
    image: str
    language: Optional[str] = "en"

class WhatsAppAudioRequest(BaseModel):
    audio: str
    mime_type: Optional[str] = "audio/ogg"
    language: Optional[str] = "en"

class AnalyzeResponse(BaseModel):
    success: bool
    analysis: dict
    processed_image: Optional[str] = None
    timestamp: str
    mode: str = "nvidia"

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global nvidia_service, tts_service
    print("🚀 Starting AgroVoice Specialty API...")
    
    print("🧠 Initializing NVIDIA Vision Service...")
    nvidia_service = NvidiaVisionService()
    
    print("🎤 Initializing NVIDIA TTS Service...")
    tts_service = NvidiaTTSService()
    
    print("✅ Server ready!")
    yield
    print("🛑 Shutting down AgroVoice Specialty API...")

app = FastAPI(
    title="AgroVoice Specialty API",
    description="High-accuracy plant disease detection using NVIDIA Llama 3.2 Vision",
    version="1.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Bird Detection routes
app.include_router(bird_router)

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "nvidia_ready": nvidia_service is not None and nvidia_service.client is not None,
        "timestamp": datetime.now().isoformat(),
    }

@app.get("/api/model/info")
async def model_info():
    return {
        "model_type": "NVIDIA Specialist Insight",
        "nvidia_model": "meta/llama-3.2-90b-vision-instruct",
        "capabilities": ["multi-crop", "multi-language", "disease-detection"]
    }

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_image(request: AnalyzeRequest):
    global nvidia_service
    
    if not request.image:
        raise HTTPException(status_code=400, detail="Image is required")
    
    if not nvidia_service:
        raise HTTPException(status_code=503, detail="NVIDIA service not initialized")

    try:
        # 1. Decode & Optimize Image
        from utils.image_processing import decode_base64_image, resize_for_ai, image_to_base64
        
        print(f"📸 [ANALYZE] Processing with NVIDIA Llama 3.2 90B Vision...")
        
        try:
            pil_image = decode_base64_image(request.image)
            # Optimized size for cloud analysis
            optimized_image = resize_for_ai(pil_image, max_dim=800)
            optimized_b64 = image_to_base64(optimized_image)
        except Exception as e:
            print(f"❌ [ANALYZE] Image processing failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid image data")

        # 2. Call NVIDIA Service
        import asyncio
        import hashlib
        
        # Simple cache key based on image hash and language
        img_hash = hashlib.md5(optimized_b64.encode()).hexdigest()
        cache_key = f"{img_hash}_{request.language}"
        
        if cache_key in vision_cache:
            print("📦 [ANALYZE] Returning cached NVIDIA analysis")
            return AnalyzeResponse(
                success=True,
                analysis=vision_cache[cache_key],
                processed_image=request.image,
                timestamp=datetime.now().isoformat(),
                mode="nvidia"
            )

        try:
            result = await asyncio.wait_for(
                nvidia_service.analyze_image(optimized_b64, request.language), 
                timeout=45.0
            )
        except asyncio.TimeoutError:
            print("❌ [ANALYZE] NVIDIA Analysis timed out")
            raise HTTPException(status_code=504, detail="Analysis timed out")
        
        if not result["success"]:
             raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))
        
        # Store in cache
        vision_cache[cache_key] = result["analysis"]
        if len(vision_cache) > 100: # Primitive LRU
            vision_cache.pop(next(iter(vision_cache)))

        return AnalyzeResponse(
            success=True,
            analysis=result["analysis"],
            processed_image=request.image, 
            timestamp=datetime.now().isoformat(),
            mode="nvidia"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [ANALYZE] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    global tts_service
    if not tts_service:
        raise HTTPException(status_code=503, detail="TTS service not initialized")
    
    # Cache key for TTS
    import hashlib
    text_hash = hashlib.md5(request.text.encode()).hexdigest()
    cache_key = f"{text_hash}_{request.language}_{request.voice}_{request.force_edge}"
    
    if cache_key in tts_cache:
        print("📦 [TTS] Returning cached audio")
        audio_content = tts_cache[cache_key]
        media_type = "audio/mpeg"
        if audio_content.startswith(b'RIFF'):
            media_type = "audio/wav"
        return Response(content=audio_content, media_type=media_type)

    try:
        audio_content = await tts_service.generate_audio(
            request.text,
            request.language,
            request.voice or "mia",
            force_edge=request.force_edge
        )
        if not audio_content:
            print(f"❌ [TTS] generate_audio returned None (lang={request.language}, voice={request.voice})", flush=True)
            raise HTTPException(status_code=500, detail="TTS generation failed")
            
        # Store in cache
        tts_cache[cache_key] = audio_content
        if len(tts_cache) > 200: # Primitive LRU
            tts_cache.pop(next(iter(tts_cache)))
            
        # Determine media type by checking first 4 bytes for RIFF (WAV)
        media_type = "audio/mpeg"
        if audio_content.startswith(b'RIFF'):
            media_type = "audio/wav"
            
        return Response(content=audio_content, media_type=media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BirdDetectRequest(BaseModel):
    image: str  # base64 encoded image
    language: Optional[str] = "en"

@app.post("/api/analyze-bird")
async def analyze_bird_image(request: BirdDetectRequest):
    """Detect birds in a single image using YOLO (BirdDetector)."""
    import base64
    import numpy as np

    try:
        import cv2
    except ImportError:
        raise HTTPException(status_code=503, detail="OpenCV not available")

    try:
        # Decode base64 → numpy frame
        raw = request.image.split(',')[-1]
        img_bytes = base64.b64decode(raw)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data")

        from bird_server import detector as bird_detector
        detected, confidence, thumbnail_b64 = bird_detector.detect_in_frame(frame)

        return {
            "success": True,
            "detected": detected,
            "confidence": round(confidence * 100, 1),
            "thumbnail": thumbnail_b64,
            "message": "Bird detected!" if detected else "No birds detected in image"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Bird Detect] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class STTRequest(BaseModel):
    audio: str  # base64-encoded audio bytes
    mime_type: Optional[str] = "audio/ogg"
    language: Optional[str] = "en"

@app.post("/api/stt")
async def speech_to_text(request: STTRequest):
    """Transcribe base64-encoded audio using NVIDIA Whisper."""
    from services.nvidia_stt import NvidiaSTTService
    import base64

    stt_service = NvidiaSTTService()
    if not stt_service.client:
        raise HTTPException(status_code=503, detail="STT service unavailable: API key missing")

    try:
        audio_bytes = base64.b64decode(request.audio)
        transcript = await stt_service.transcribe_audio(audio_bytes, request.mime_type, request.language)
        if not transcript:
            raise HTTPException(status_code=500, detail="Transcription returned empty result")
        return {"success": True, "transcript": transcript}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [STT Route] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/whatsapp/chat")
async def whatsapp_chat(request: WhatsAppChatRequest):
    service = get_whatsapp_service()
    reply = await service.chat(request.text, request.language)
    return {"success": True, "reply": reply}

@app.post("/api/whatsapp/image")
async def whatsapp_image(request: WhatsAppImageRequest):
    global nvidia_service, tts_service
    service = get_whatsapp_service()
    
    # 1. Analyze image using NVIDIA
    if not nvidia_service:
        return {"success": False, "reply": "⚠️ Image service not ready."}
        
    result = await nvidia_service.analyze_image(request.image, request.language)
    if not result["success"]:
        return {"success": False, "reply": "⚠️ Image analysis failed."}
        
    # 2. Format reply for WhatsApp
    reply_text = build_image_reply(result["analysis"], request.language)
    
    # 3. Optional: Generate audio for the reply
    # NOTE: Force Edge TTS so we always get MP3 (WhatsApp rejects WAV audio)
    audio_b64 = None
    error_context = None
    if tts_service:
        try:
            # Build a concise spoken summary of the analysis for the voice note
            import re
            analysis = result.get("analysis", {})
            crop = analysis.get("crop_identified") or analysis.get("crop", "plant")
            disease = analysis.get("disease_name") or "Unknown condition"
            description = analysis.get("description") or ""
            severity = analysis.get("severity") or ""
            treatment = analysis.get("treatment_steps", [])
            treatment_text = "; ".join(treatment[:2]) if treatment else ""

            spoken_text = (
                f"Plant analysis complete. Crop: {crop}. "
                f"Condition detected: {disease}. "
                f"Severity: {severity}. "
                f"{description[:200]}. "
            )
            if treatment_text:
                spoken_text += f"Recommended treatment: {treatment_text}."

            # Clean any markdown symbols before speaking
            clean_text = re.sub(r'[*_~`#]', '', spoken_text)

            # Force Edge TTS to guarantee MP3 output (WhatsApp voice notes require MP3 or OGG)
            # Use cache to avoid redundant generations
            import hashlib
            text_hash = hashlib.md5(clean_text.encode()).hexdigest()
            # Force edge_tts=True in the cache key for WhatsApp
            whatsapp_cache_key = f"{text_hash}_{request.language}_mia_True"
            
            if whatsapp_cache_key in tts_cache:
                print("📦 [WhatsApp Image] Returning cached MP3 audio", flush=True)
                audio_bytes = tts_cache[whatsapp_cache_key]
            else:
                audio_bytes = await tts_service.generate_audio(clean_text, request.language, force_edge=True)
                if audio_bytes:
                    tts_cache[whatsapp_cache_key] = audio_bytes
                    if len(tts_cache) > 200:
                        tts_cache.pop(next(iter(tts_cache)))

            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
            else:
                error_context = "TTS Service returned empty audio"
        except Exception as e:
            error_context = f"TTS Error: {str(e)}"
            print(f"❌ [WhatsApp Image] TTS Exception: {e}", flush=True)
            
    return {
        "success": True,
        "reply": reply_text,
        "audio_b64": audio_b64,
        "error_context": error_context
    }

@app.post("/api/whatsapp/audio")
async def whatsapp_audio(request: WhatsAppAudioRequest):
    audio_bytes = base64.b64decode(request.audio)
    service = get_whatsapp_service()
    result = await service.transcribe_and_reply(
        audio_bytes, 
        request.mime_type, 
        request.language
    )
    return result

if __name__ == "__main__":
    import uvicorn
    import sys
    # Force unbuffered stdout so logs appear immediately in tail -f
    sys.stdout.reconfigure(line_buffering=True)
    uvicorn.run(app, host="0.0.0.0", port=8000)
