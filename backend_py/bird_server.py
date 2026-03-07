"""
Bird Detection API Server - FastAPI routes for bird detection service
Provides MJPEG streaming, status reporting, and video upload endpoints
"""

import os
import shutil
import asyncio
from typing import Optional
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from detector import BirdDetector


# ============================================================================
# Configuration
# ============================================================================

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
MAX_FILE_SIZE_MB = 500  # Maximum upload size in MB


# ============================================================================
# Response Models
# ============================================================================

class StatusResponse(BaseModel):
    """Detection status response"""
    detected: bool
    last_detected: Optional[str]
    confidence: float
    alert_active: bool
    thumbnail: Optional[str] = None  # Base64 encoded JPEG thumbnail


class UploadResponse(BaseModel):
    """Video upload response"""
    success: bool
    message: str
    filename: Optional[str] = None


class ResetResponse(BaseModel):
    """Reset response"""
    success: bool
    message: str


# ============================================================================
# Global Detector Instance
# ============================================================================

# Single detector instance shared across requests
_detector: Optional[BirdDetector] = None


def get_detector() -> BirdDetector:
    """Get or create the global detector instance"""
    global _detector
    if _detector is None:
        _detector = BirdDetector(
            model_path="yolov8n.pt",
            confidence_threshold=0.35,  # Lowered for better detection
            cooldown_seconds=3.0  # Faster alerts
        )
    return _detector


# Store latest detection frame for thumbnails
_latest_detection_frame: Optional[bytes] = None


# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/api/bird", tags=["Bird Detection"])


@router.get("/status", response_model=StatusResponse)
async def get_status():
    """
    Get current bird detection status.
    
    Returns detection state including:
    - detected: Whether a bird is currently detected
    - last_detected: ISO timestamp of last detection
    - confidence: Detection confidence score (0.0-1.0)
    - alert_active: Whether deterrent alert should be triggered
    - thumbnail: Base64 JPEG of latest detection frame
    """
    global _latest_detection_frame
    detector = get_detector()
    status = detector.get_status()
    
    # Include thumbnail if we have a detection frame
    thumbnail_b64 = None
    if _latest_detection_frame and status["detected"]:
        import base64
        thumbnail_b64 = base64.b64encode(_latest_detection_frame).decode('utf-8')
    
    return StatusResponse(
        **status,
        thumbnail=thumbnail_b64
    )


@router.get("/feed")
async def get_feed():
    """
    Stream processed video frames as MJPEG.
    
    Returns a multipart stream of JPEG frames with bird detection
    bounding boxes overlaid. The stream continues until the client
    disconnects or the video source ends.
    """
    detector = get_detector()
    
    if not detector.has_source:
        # Return a placeholder frame if no source
        return Response(
            content=_generate_placeholder_frame(),
            media_type="image/jpeg"
        )
    
    return StreamingResponse(
        _generate_frames(detector),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


async def _generate_frames(detector: BirdDetector):
    """
    Async generator for MJPEG frames.
    
    Yields JPEG frames at approximately 20 FPS to balance
    responsiveness with CPU usage.
    """
    global _latest_detection_frame
    frame_delay = 1 / 20  # Target 20 FPS
    
    while True:
        try:
            frame_bytes = detector.process_frame()
            
            if frame_bytes is None:
                # No more frames, yield placeholder then stop
                yield _create_mjpeg_frame(_generate_placeholder_frame())
                break
            
            # Store frame for thumbnail if bird detected
            if detector.state.detected:
                _latest_detection_frame = frame_bytes
                
            yield _create_mjpeg_frame(frame_bytes)
            
            # Small delay to control frame rate and allow other coroutines
            await asyncio.sleep(frame_delay)
            
        except Exception as e:
            print(f"Frame generation error: {e}")
            break


def _create_mjpeg_frame(jpeg_bytes: bytes) -> bytes:
    """Create an MJPEG frame with proper boundary markers"""
    return (
        b"--frame\r\n"
        b"Content-Type: image/jpeg\r\n\r\n" +
        jpeg_bytes +
        b"\r\n"
    )


def _generate_placeholder_frame() -> bytes:
    """Generate a placeholder frame when no video source is active"""
    import cv2
    import numpy as np
    
    # Create a dark frame with message
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame[:] = (30, 30, 35)  # Dark gray
    
    # Add text
    text = "Upload a video to start"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.8
    thickness = 2
    
    # Center the text
    (text_w, text_h), _ = cv2.getTextSize(text, font, font_scale, thickness)
    x = (640 - text_w) // 2
    y = (480 + text_h) // 2
    
    cv2.putText(frame, text, (x, y), font, font_scale, (128, 128, 128), thickness)
    
    # Add a bird icon (simple representation)
    cv2.circle(frame, (320, 200), 40, (60, 60, 70), -1)
    cv2.circle(frame, (320, 200), 40, (80, 80, 90), 2)
    
    # Encode to JPEG
    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return jpeg.tobytes()


@router.post("/upload", response_model=UploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a video file for bird detection analysis.
    
    The uploaded video becomes the active source for the /feed endpoint.
    Supports MP4, AVI, MOV, MKV, WEBM, and M4V formats.
    Maximum file size: 500MB
    """
    # Validate file extension
    if not file.filename:
        raise HTTPException(400, "No filename provided")
        
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            400,
            f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"bird_video_{timestamp}{ext}"
    file_path = UPLOAD_DIR / safe_filename
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            # Read in chunks to handle large files
            chunk_size = 1024 * 1024  # 1MB chunks
            total_size = 0
            max_size = MAX_FILE_SIZE_MB * 1024 * 1024
            
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                    
                total_size += len(chunk)
                if total_size > max_size:
                    # Clean up and reject
                    buffer.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(413, f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB")
                    
                buffer.write(chunk)
        
        # Set as active video source
        detector = get_detector()
        success = detector.set_video_source(str(file_path))
        
        if not success:
            file_path.unlink(missing_ok=True)
            raise HTTPException(500, "Failed to open video file. The file may be corrupted.")
        
        return UploadResponse(
            success=True,
            message="Video uploaded and processing started",
            filename=safe_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up on error
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.post("/reset", response_model=ResetResponse)
async def reset_detector():
    """
    Reset the bird detector to idle state.
    
    Clears the current video source, stops streaming, and
    cleans up temporary files.
    """
    detector = get_detector()
    detector.release_video_source()
    
    # Clean up old uploaded files (keep last 5)
    try:
        files = sorted(UPLOAD_DIR.glob("bird_video_*"), key=os.path.getmtime, reverse=True)
        for old_file in files[5:]:  # Keep only the 5 most recent
            old_file.unlink(missing_ok=True)
    except Exception as e:
        print(f"Cleanup warning: {e}")
    
    return ResetResponse(
        success=True,
        message="Detector reset to idle state"
    )


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint for the bird detection service"""
    detector = get_detector()
    return {
        "status": "healthy",
        "has_source": detector.has_source,
        "model_loaded": detector.model is not None
    }
