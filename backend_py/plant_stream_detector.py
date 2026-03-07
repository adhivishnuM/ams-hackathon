"""
Plant Stream Detector - Real-time video analysis for plant disease detection.
Handles camera feed, runs detection, and annotates frames.
"""
import threading
import time
from typing import Optional, Tuple, Dict, Any

import cv2
import numpy as np
from PIL import Image

from models.yolo_detector import PlantDiseaseDetector


class PlantStreamDetector:
    """
    Video stream handler for real-time plant analysis.
    Manages camera, runs periodic detection, and renders results.
    """
    
    def __init__(self, model_path: str = None):
        self.detector = PlantDiseaseDetector(model_path)
        self.last_analysis_time = 0
        self.analysis_interval = 0.25  # Analyze every 250ms
        self.last_result: Optional[Dict[str, Any]] = None
        
        # Video source management
        self._video_source: Optional[cv2.VideoCapture] = None
        self._video_lock = threading.Lock()
        self._source_path: Optional[str] = None
        
        print("📹 PlantStreamDetector initialized")

    def set_video_source(self, source: str) -> bool:
        """Set video source (camera index or file path)"""
        with self._video_lock:
            if self._video_source is not None:
                self._video_source.release()
                
            try:
                if source.isdigit():
                    self._video_source = cv2.VideoCapture(int(source))
                else:
                    self._video_source = cv2.VideoCapture(source)
                    
                if not self._video_source.isOpened():
                    print(f"❌ Failed to open video source: {source}")
                    self._video_source = None
                    self._source_path = None
                    return False
                    
                self._source_path = source
                self.last_result = None
                print(f"✅ Video source opened: {source}")
                return True
            except Exception as e:
                print(f"❌ Error opening video source: {e}")
                self._video_source = None
                return False

    def release_video_source(self):
        """Release the current video source"""
        with self._video_lock:
            if self._video_source is not None:
                self._video_source.release()
                self._video_source = None
                self._source_path = None
            self.last_result = None

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read a frame from the video source"""
        with self._video_lock:
            if self._video_source is None:
                return False, None
                
            ret, frame = self._video_source.read()
            
            # Loop video files
            if not ret and self._source_path and not self._source_path.isdigit():
                self._video_source.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._video_source.read()
                
            return ret, frame

    def process_frame(self) -> Optional[bytes]:
        """
        Process one frame: read, analyze, annotate, encode to JPEG.
        """
        ret, frame = self.read_frame()
        if not ret or frame is None:
            return None
            
        current_time = time.time()
        
        # Run analysis periodically
        if current_time - self.last_analysis_time > self.analysis_interval:
            try:
                # Convert BGR to RGB for PIL
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                # Run detection
                result = self.detector.detect(pil_image)
                
                # Only update if we got a valid detection
                if result is not None:
                    self.last_result = result
                    
            except Exception as e:
                print(f"Detection error: {e}")
            
            self.last_analysis_time = current_time
        
        # Annotate frame with detection results
        annotated_frame = self._annotate_frame(frame, self.last_result)
        
        # Encode to JPEG
        _, jpeg = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return jpeg.tobytes()

    def _annotate_frame(self, frame: np.ndarray, result: Optional[Dict[str, Any]]) -> np.ndarray:
        """Draw detection results on the video frame"""
        if result is None:
            return frame
            
        annotated = frame.copy()
        h, w = frame.shape[:2]
        
        # Get detection info
        crop = result.get("crop_identified", "Unknown")
        disease = result.get("disease_name", "Analyzing...")
        confidence = result.get("confidence", 0)
        is_healthy = result.get("is_healthy", True)
        
        # Colors: Green = healthy, Red = issue
        color = (0, 255, 0) if is_healthy else (0, 0, 255)
        bg_color = (0, 80, 0) if is_healthy else (0, 0, 80)
        
        # Draw top banner with detection info
        cv2.rectangle(annotated, (0, 0), (w, 65), bg_color, -1)
        
        # Main text
        text = f"{crop}: {disease}"
        cv2.putText(annotated, text, (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 
                   1.0, (255, 255, 255), 2)
        
        # Confidence
        conf_text = f"Confidence: {confidence}%"
        cv2.putText(annotated, conf_text, (15, 55), cv2.FONT_HERSHEY_SIMPLEX,
                   0.5, (200, 200, 200), 1)
        
        # Draw disease regions (orange boxes) if not healthy
        if not is_healthy:
            regions = result.get("disease_regions", [])
            for region in regions:
                rx, ry, rw, rh = region.get("x"), region.get("y"), region.get("w"), region.get("h")
                if all(v is not None for v in [rx, ry, rw, rh]):
                    cv2.rectangle(annotated, (rx, ry), (rx+rw, ry+rh), (0, 165, 255), 2)
        
        # Status indicator circle
        indicator_color = (0, 255, 0) if is_healthy else (0, 0, 255)
        cv2.circle(annotated, (w - 30, 32), 15, indicator_color, -1)
        
        return annotated

    def get_status(self) -> Dict[str, Any]:
        """Get current detection status for API polling"""
        if self.last_result is None:
            return {
                "detected": False, 
                "message": "Point camera at a leaf or lemon"
            }
            
        return {
            "detected": True,
            "crop": self.last_result.get("crop_identified"),
            "status": self.last_result.get("disease_name"),
            "health_score": self.last_result.get("analysis_details", {}).get("health_score", 0),
            "confidence": self.last_result.get("confidence", 0),
            "is_healthy": self.last_result.get("is_healthy", True)
        }
    
    @property
    def has_source(self) -> bool:
        with self._video_lock:
            return self._video_source is not None and self._video_source.isOpened()
