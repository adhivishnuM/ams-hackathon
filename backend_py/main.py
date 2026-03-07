"""
AgroVoice Backend - Plant Disease Detection API using YOLOv8
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.yolo_detector import PlantDiseaseDetector
from utils.image_processing import decode_base64_image, preprocess_image
from utils.visualization import process_and_visualize
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

app = FastAPI(
    title="AgroVoice Disease Detection API",
    description="Plant disease detection using General (YOLO) or Farmer Assist (NVIDIA) modes",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Bird Detection routes
app.include_router(bird_router)

# Include Plant Stream routes
from plant_server import router as plant_router
app.include_router(plant_router)

detector: Optional[PlantDiseaseDetector] = None
nvidia_service: Optional[NvidiaVisionService] = None
tts_service: Optional[NvidiaTTSService] = None

class AnalyzeRequest(BaseModel):
    image: str
    cropType: Optional[str] = None
    language: Optional[str] = "en"
    mode: Optional[str] = "yolo" # "yolo" or "nvidia"

class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    voice: Optional[str] = "mia"  # mia, aria, sofia
    force_edge: Optional[bool] = False

# WhatsApp Bridge Request Models
class WhatsAppChatRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

class WhatsAppImageRequest(BaseModel):
    image: str  # Base64-encoded image
    language: Optional[str] = "en"

class WhatsAppAudioRequest(BaseModel):
    audio: str       # Base64-encoded audio
    mime_type: Optional[str] = "audio/ogg"
    language: Optional[str] = "en"

class AnalyzeResponse(BaseModel):
    success: bool
    analysis: dict
    processed_image: Optional[str] = None
    timestamp: str
    mode: Optional[str] = "yolo"

@app.on_event("startup")
async def startup_event():
    global detector, nvidia_service, tts_service
    print("🚀 Starting AgroVoice Disease Detection API...")
    
    print("📦 Loading YOLO model...")
    model_path = os.environ.get("MODEL_PATH", None)
    detector = PlantDiseaseDetector(model_path=model_path)
    if detector and detector.model is not None:
        num_classes = len(detector.names) if hasattr(detector, 'names') else 0
        print(f"✅ YOLO Model loaded successfully (Classes: {num_classes})")
    else:
        print("⚠️ YOLO Model NOT loaded - will use NVIDIA Vision fallback only")
    
    print("🧠 Initializing NVIDIA Vision Service...")
    nvidia_service = NvidiaVisionService()
    
    print("🎤 Initializing NVIDIA TTS Service...")
    tts_service = NvidiaTTSService()
    
    print("✅ Server ready!")

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "yolo_loaded": detector is not None and detector.model is not None,
        "nvidia_ready": nvidia_service is not None and nvidia_service.client is not None,
        "timestamp": datetime.now().isoformat(),
    }

@app.get("/api/model/info")
async def model_info():
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {
        "model_type": "General + Farmer Assist (Dual Mode)",
        "num_classes": len(detector.TARGET_CLASSES),
        "target_classes": detector.TARGET_CLASSES,
        "nvidia_model": "meta/llama-3.2-90b-vision-instruct"
    }

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_image(request: AnalyzeRequest):
    global detector, nvidia_service
    
    if not request.image:
        raise HTTPException(status_code=400, detail="Image is required")
    
    try:
        print(f"📸 [ANALYZE] Processing request (Mode: {request.mode})...")
        
        # Scenario A: NVIDIA Mode
        if request.mode == "nvidia":
            if not nvidia_service:
                raise HTTPException(status_code=503, detail="NVIDIA service not initialized")
            
            # Add explicit timeout for the API call wrapper (just in case)
            import asyncio
            try:
                result = await asyncio.wait_for(nvidia_service.analyze_image(request.image, request.language), timeout=50.0)
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="NVIDIA Analysis timed out")
            
            if not result["success"]:
                 raise HTTPException(status_code=500, detail=result["error"])
            
            return AnalyzeResponse(
                success=True,
                analysis=result["analysis"],
                processed_image=request.image, # Return original for now as NVIDIA doesn't draw boxes
                timestamp=datetime.now().isoformat(),
                mode="nvidia"
            )

        # Scenario B: YOLO Mode (Default)
        if detector is None:
            raise HTTPException(status_code=503, detail="YOLO Model not loaded")

        # 1. Decode & Preprocess
        try:
            original_image = decode_base64_image(request.image)
        except Exception as e:
            print(f"❌ [ANALYZE] Decode failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format or data")

        model_input = preprocess_image(original_image, target_size=(224, 224))
        
        # 2. Run Model (Offload to thread pool to prevent blocking event loop)
        print("🤖 [ANALYZE] Running YOLO inference...")
        import asyncio
        loop = asyncio.get_event_loop()
        # Run synchronous YOLO detect in a separate thread
        result = await loop.run_in_executor(None, detector.detect, model_input)
        
        # 3. Enhance with NVIDIA AI (if available) for much better naming
        if nvidia_service and nvidia_service.client:
            try:
                print("🧠 [ANALYZE] Enhancing with NVIDIA Specialist Insight...")
                # Request a quick analysis from NVIDIA to get the real names
                # Add a shorter timeout for enhancement - if it takes too long, just use YOLO
                try:
                    nv_result = await asyncio.wait_for(nvidia_service.analyze_image(request.image, request.language), timeout=15.0)
                    if nv_result["success"]:
                        nv_analysis = nv_result["analysis"]
                        # Merge NVIDIA's accurate names and descriptions into the result
                        result["disease_name"] = nv_analysis.get("disease_name", result["disease_name"])
                        result["disease_name_hindi"] = nv_analysis.get(f"disease_name_{request.language}", nv_analysis.get("disease_name_localized", result["disease_name_hindi"]))
                        result["crop_identified"] = nv_analysis.get("crop_identified", result["crop_identified"])
                        result["description"] = nv_analysis.get("description", result["description"])
                        result["description_hindi"] = nv_analysis.get(f"description_{request.language}", nv_analysis.get("description_localized", result["description_hindi"]))
                        result["symptoms"] = nv_analysis.get("symptoms", result["symptoms"])
                        result["treatment_steps"] = nv_analysis.get("treatment_steps", result["treatment_steps"])
                        result["organic_options"] = nv_analysis.get("organic_options", result["organic_options"])
                        result["prevention_tips"] = nv_analysis.get("prevention_tips", result["prevention_tips"])
                        # Use NVIDIA's confidence if it's high
                        if nv_analysis.get("confidence"):
                            result["confidence"] = nv_analysis["confidence"]
                        # SYNC HEALTH STATUS
                        if "is_healthy" in nv_analysis:
                            result["is_healthy"] = nv_analysis["is_healthy"]
                        if "severity" in nv_analysis:
                            result["severity"] = nv_analysis["severity"]
                    else:
                        print(f"⚠️ [ANALYZE] NVIDIA enhancement returned error: {nv_result.get('error')}")
                except asyncio.TimeoutError:
                    print("⚠️ [ANALYZE] NVIDIA enhancement timed out - Proceeding with YOLO result only")
            except Exception as nve:
                print(f"⚠️ [ANALYZE] NVIDIA enhancement failed: {nve}")

        # 4. Generate Visualizations (Softly fail if this parts crashes)
        processed_image_b64 = None
        try:
            print("🎨 [ANALYZE] Drawing disease regions...")
            display_image = original_image.copy()
            # Ensure manageable size for display
            if display_image.width > 800 or display_image.height > 800:
                display_image.thumbnail((800, 800))
            
            # Use new visualization with precise disease regions    
            _, processed_b64 = process_and_visualize(display_image, result)
            processed_image_b64 = "data:image/png;base64," + processed_b64
        except Exception as ve:
            print(f"⚠️ [ANALYZE] Visualization failed (soft fail): {ve}")
            # Fallback to original image if visualization failed
            try:
                buffered = io.BytesIO()
                original_image.save(buffered, format="JPEG")
                processed_image_b64 = "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode()
            except:
                pass
        
        return AnalyzeResponse(
            success=True,
            analysis=result,
            processed_image=processed_image_b64,
            timestamp=datetime.now().isoformat(),
            mode="yolo"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [ANALYZE] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/tts")
async def generate_speech(request: TTSRequest):
    global tts_service
    if tts_service is None:
        raise HTTPException(status_code=503, detail="TTS service not initialized")
    
    try:
        # Normalize language code (handle en-US, hi-IN etc.)
        lang_code = request.language.split("-")[0].lower() if request.language else "en"
        voice = request.voice or "mia"
        force_edge = request.force_edge or False
        audio_bytes = await tts_service.generate_audio(request.text, lang_code, voice, force_edge)
        if not audio_bytes:
             raise HTTPException(status_code=500, detail="TTS generation failed")
             
        # Convert to base64
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        return {
            "success": True,
            "audio": audio_base64,
            "content_type": "audio/wav"
        }
    except Exception as e:
        print(f"❌ [TTS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat_offline")
async def chat_offline(request: dict):
    """
    Offline AI Assistant that uses the local knowledge base with a conversational voice.
    """
    text = request.get("text", "").lower()
    lang = request.get("language", "en")
    
    # Load knowledge base locally in Python for speed
    import json
    import random
    kb_path = os.path.join(os.path.dirname(__file__), "../backend/data/agricultural_knowledge.json")
    try:
        with open(kb_path, 'r', encoding='utf-8') as f:
            kb = json.load(f)
    except:
        return {"success": False, "error": "Knowledge base not found: " + kb_path}

    def make_conversational(content, topic_name):
        intros = {
            "en": [
                f"Regarding {topic_name}, here is some advice. ",
                f"For {topic_name}, I've learned that ",
                f"Ah, {topic_name}! Here is a quick rundown."
            ],
            "hi": [
                f"{topic_name} के लिए, यहाँ मेरी सलाह है। ",
                f"हाँ, {topic_name} को लेकर अक्सर पूछा जाता है। देखिए... ",
                f"तो आप {topic_name} के बारे में जानना चाहते हैं? मैं बताता हूँ..."
            ]
        }
        prefix = random.choice(intros.get(lang, intros["en"]))
        return f"{prefix} {content}"

    # Simple Keyword-based Intelligence
    response_parts = []
    
    # Check crops
    detected_crop = None
    for crop_key, crop_data in kb.get("crops", {}).items():
        if any(name in text for name in crop_data.get("names", [])) or crop_key in text:
            detected_crop = (crop_key, crop_data)
            break
    
    if detected_crop:
        key, data = detected_crop
        topic = "care"
        for t_key, keywords in kb.get("topics", {}).items():
            if any(kw in text for kw in keywords):
                topic = t_key
                break
        
        advice = data.get(topic, {}).get(lang) or data.get("care", {}).get(lang) or data.get(topic, {}).get("en")
        if advice:
            return {"success": True, "text": make_conversational(advice, key.capitalize()), "source": "local_wisdom"}

    # Check Diseases
    for d_key, d_data in kb.get("disease_reference", {}).items():
        if d_key.replace("_", " ") in text:
            symp = d_data.get("symptoms", {}).get(lang) or d_data.get("symptoms", {}).get("en")
            treat = d_data.get("treatment", {}).get(lang) or d_data.get("treatment", {}).get("en")
            content = f"{symp}\n\n**Here's the plan:** {treat}"
            return {"success": True, "text": make_conversational(content, d_key.replace('_', ' ').capitalize()), "source": "local_wisdom"}

    # Check Pests
    for p_key, p_data in kb.get("pest_reference", {}).items():
        if p_key.replace("_", " ") in text:
            symp = p_data.get("symptoms", {}).get(lang) or p_data.get("symptoms", {}).get("en")
            ctrl = p_data.get("control", {}).get(lang) or p_data.get("control", {}).get("en")
            content = f"{symp}\n\n**What you should do:** {ctrl}"
            return {"success": True, "text": make_conversational(content, p_key.replace('_', ' ').capitalize()), "source": "local_wisdom"}

    return {
        "success": False,
        "error": "No specific match found in local wisdom.",
        "text": "I couldn't find a direct match for that in my files."
    }

# ─────────────────────────────────────────────────────────────
# WhatsApp Bridge Endpoints
# ─────────────────────────────────────────────────────────────

@app.post("/api/whatsapp/chat")
async def whatsapp_chat(request: WhatsAppChatRequest):
    """
    WhatsApp text message → AI agricultural assistant reply.
    Returns a WhatsApp-formatted text response.
    """
    try:
        wa_service = get_whatsapp_service()
        reply = await wa_service.chat(request.text, request.language)
        return {"success": True, "reply": reply}
    except Exception as e:
        print(f"❌ [WhatsApp Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/whatsapp/analyze_image")
async def whatsapp_analyze_image(request: WhatsAppImageRequest):
    """
    WhatsApp image → NVIDIA Vision analysis → WhatsApp-formatted report.
    Optionally also generates a TTS audio reply.
    """
    global nvidia_service, tts_service
    try:
        if not nvidia_service:
            raise HTTPException(status_code=503, detail="NVIDIA Vision service not initialized")

        import asyncio
        result = await asyncio.wait_for(
            nvidia_service.analyze_image(request.image, request.language),
            timeout=50.0
        )

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))

        analysis = result["analysis"]
        whatsapp_reply = build_image_reply(analysis, request.language)

        # Generate short TTS summary for voice note
        audio_b64 = None
        if tts_service:
            disease = analysis.get("disease_name", "Unknown")
            crop = analysis.get("crop_identified", "plant")
            severity = analysis.get("severity", "unknown")
            is_healthy = analysis.get("is_healthy", False)
            if is_healthy:
                tts_text = f"Your {crop} looks healthy! No disease detected."
            else:
                tts_text = f"Analysis complete. Your {crop} shows {disease} with {severity} severity. Check the report for treatment steps."

            try:
                audio_bytes = await tts_service.generate_audio(tts_text, request.language or "en")
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            except Exception as te:
                print(f"⚠️ [WhatsApp Image] TTS failed: {te}")

        return {
            "success": True,
            "reply": whatsapp_reply,
            "audio_b64": audio_b64,
            "analysis": analysis
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [WhatsApp Image] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/whatsapp/transcribe_and_reply")
async def whatsapp_transcribe_and_reply(request: WhatsAppAudioRequest):
    """
    WhatsApp voice note → STT → AI reply → TTS audio reply.
    Returns: transcript, text_reply (formatted), audio_reply_b64 (MP3 base64)
    """
    try:
        audio_bytes = base64.b64decode(request.audio)
        wa_service = get_whatsapp_service()
        result = await wa_service.transcribe_and_reply(
            audio_bytes,
            mime_type=request.mime_type or "audio/ogg",
            language=request.language or "en"
        )
        return {"success": True, **result}
    except Exception as e:
        print(f"❌ [WhatsApp Audio] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
