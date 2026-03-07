"""
Plant Stream API Server - FastAPI routes for live plant disease detection.
Provides MJPEG streaming and status for real-time plant analysis.
"""

import asyncio
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from plant_stream_detector import PlantStreamDetector

import cv2
import numpy as np


# ============================================================================
# Response Models
# ============================================================================

class PlantStatusResponse(BaseModel):
    detected: bool
    crop: Optional[str] = None
    status: Optional[str] = None
    confidence: float = 0
    is_healthy: bool = True
    message: Optional[str] = None


# ============================================================================
# Global Detector Instance
# ============================================================================

_plant_detector: Optional[PlantStreamDetector] = None


def get_plant_detector() -> PlantStreamDetector:
    """Get or create the global plant detector instance"""
    global _plant_detector
    if _plant_detector is None:
        print("🌱 Initializing Plant Stream Detector...")
        _plant_detector = PlantStreamDetector()
    return _plant_detector


# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/api/plant", tags=["Plant Detection"])


@router.get("/status", response_model=PlantStatusResponse)
async def get_plant_status():
    """Get current plant detection status"""
    detector = get_plant_detector()
    status = detector.get_status()
    return PlantStatusResponse(**status)


@router.get("/feed")
async def get_plant_feed():
    """
    Stream processed video frames as MJPEG for plant analysis.
    Uses the device's default camera (index 0).
    """
    detector = get_plant_detector()
    
    # Auto-start camera if not already active
    if not detector.has_source:
        print("📷 Starting camera for plant feed...")
        success = detector.set_video_source("0")  # Default camera
        if not success:
            return Response(
                content=_generate_placeholder("Camera not available"),
                media_type="image/jpeg"
            )
    
    return StreamingResponse(
        _generate_plant_frames(detector),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


async def _generate_plant_frames(detector: PlantStreamDetector):
    """
    Async generator for MJPEG frames.
    Optimized: Target 15 FPS for smooth video with analysis updates.
    """
    frame_delay = 1 / 15  # 15 FPS - balanced for analysis + smoothness
    
    while True:
        try:
            frame_bytes = detector.process_frame()
            
            if frame_bytes is None:
                yield _create_mjpeg_frame(_generate_placeholder("No camera feed"))
                await asyncio.sleep(1)  # Wait a second, retry
                continue
                
            yield _create_mjpeg_frame(frame_bytes)
            
            # Small delay for target FPS
            await asyncio.sleep(frame_delay)
            
        except Exception as e:
            print(f"Plant frame generation error: {e}")
            await asyncio.sleep(0.5)


def _create_mjpeg_frame(jpeg_bytes: bytes) -> bytes:
    """Create an MJPEG frame with proper boundary"""
    return (
        b"--frame\r\n"
        b"Content-Type: image/jpeg\r\n\r\n" +
        jpeg_bytes +
        b"\r\n"
    )


def _generate_placeholder(message: str = "Loading...") -> bytes:
    """Generate a placeholder frame"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame[:] = (40, 40, 45)
    
    cv2.putText(frame, message, (180, 250), cv2.FONT_HERSHEY_SIMPLEX, 
                1.0, (100, 100, 100), 2)
    
    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return jpeg.tobytes()


@router.post("/stop")
async def stop_plant_feed():
    """Stop the camera feed"""
    detector = get_plant_detector()
    detector.release_video_source()
    return {"success": True, "message": "Camera stopped"}


@router.get("/health")
async def plant_health_check():
    """Health check for plant detection service"""
    detector = get_plant_detector()
    return {
        "status": "healthy",
        "has_source": detector.has_source,
        "model_loaded": detector.detector.model is not None
    }
