"""
Bird Detector Module - YOLOv8 wrapper for real-time bird detection
Uses COCO class 14 (bird) with configurable confidence threshold
"""

import threading
from datetime import datetime, timedelta
from typing import Optional, Tuple
from dataclasses import dataclass, field

import cv2
import numpy as np
from ultralytics import YOLO


@dataclass
class DetectionState:
    """Thread-safe detection state container"""
    detected: bool = False
    last_detected: Optional[datetime] = None
    confidence: float = 0.0
    alert_active: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    
    def update(self, detected: bool, confidence: float = 0.0, cooldown_seconds: float = 5.0):
        """Update detection state with thread safety"""
        with self._lock:
            now = datetime.now()
            self.detected = detected
            
            if detected:
                self.confidence = confidence
                
                # Check if cooldown has passed for alert
                if self.last_detected is None:
                    self.alert_active = True
                elif (now - self.last_detected) >= timedelta(seconds=cooldown_seconds):
                    self.alert_active = True
                else:
                    self.alert_active = False
                    
                self.last_detected = now
            else:
                self.confidence = 0.0
                self.alert_active = False
    
    def to_dict(self) -> dict:
        """Convert to JSON-serializable dictionary"""
        with self._lock:
            return {
                "detected": self.detected,
                "last_detected": self.last_detected.isoformat() if self.last_detected else None,
                "confidence": round(self.confidence, 4),
                "alert_active": self.alert_active
            }


class BirdDetector:
    """
    YOLOv8 bird detection wrapper with video processing capabilities.
    
    Features:
    - Detects birds (COCO class 14) in video frames
    - Annotates frames with bounding boxes and confidence scores
    - Maintains thread-safe detection state
    - Supports both webcam and video file input
    """
    
    BIRD_CLASS_ID = 14  # COCO dataset bird class
    
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence_threshold: float = 0.5,
        cooldown_seconds: float = 5.0
    ):
        """
        Initialize the bird detector.
        
        Args:
            model_path: Path to YOLOv8 model weights
            confidence_threshold: Minimum confidence for detection (0.0-1.0)
            cooldown_seconds: Cooldown period between alerts
        """
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = DetectionState()
        
        # Video source management
        self._video_source: Optional[cv2.VideoCapture] = None
        self._video_lock = threading.Lock()
        self._source_path: Optional[str] = None
        
    def set_video_source(self, source: str) -> bool:
        """
        Set the video source (file path or webcam index).
        
        Args:
            source: Video file path or "0" for webcam
            
        Returns:
            True if source was opened successfully
        """
        with self._video_lock:
            # Release existing source
            if self._video_source is not None:
                self._video_source.release()
                
            # Open new source
            try:
                if source.isdigit():
                    self._video_source = cv2.VideoCapture(int(source))
                else:
                    self._video_source = cv2.VideoCapture(source)
                    
                if not self._video_source.isOpened():
                    self._video_source = None
                    self._source_path = None
                    return False
                    
                self._source_path = source
                return True
                
            except Exception as e:
                print(f"Error opening video source: {e}")
                self._video_source = None
                self._source_path = None
                return False
    
    def release_video_source(self):
        """Release the current video source"""
        with self._video_lock:
            if self._video_source is not None:
                self._video_source.release()
                self._video_source = None
                self._source_path = None
                
            # Reset detection state
            self.state = DetectionState()
    
    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Read a frame from the current video source.
        
        Returns:
            Tuple of (success, frame)
        """
        with self._video_lock:
            if self._video_source is None:
                return False, None
                
            ret, frame = self._video_source.read()
            
            # Loop video if end is reached (for uploaded files)
            if not ret and self._source_path and not self._source_path.isdigit():
                self._video_source.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._video_source.read()
                
            return ret, frame
    
    def detect_birds(self, frame: np.ndarray) -> Tuple[np.ndarray, bool, float]:
        """
        Detect birds in a frame and annotate with bounding boxes.
        
        Args:
            frame: Input BGR image from OpenCV
            
        Returns:
            Tuple of (annotated_frame, bird_detected, max_confidence)
        """
        # Run inference
        results = self.model(frame, verbose=False, conf=self.confidence_threshold)
        
        bird_detected = False
        max_confidence = 0.0
        annotated_frame = frame.copy()
        
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                
                # Check if it's a bird
                if class_id == self.BIRD_CLASS_ID:
                    bird_detected = True
                    max_confidence = max(max_confidence, confidence)
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    
                    # Red color for bird detection with dynamic thickness
                    color = (0, 0, 255)  # BGR Red
                    thickness = max(2, int(min(frame.shape[:2]) / 200))
                    
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, thickness)
                    
                    # Label with confidence
                    label = f"BIRD {confidence:.0%}"
                    font_scale = max(0.5, min(frame.shape[:2]) / 800)
                    label_thickness = max(1, int(font_scale * 2))
                    
                    # Background for label
                    (label_w, label_h), baseline = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, label_thickness
                    )
                    cv2.rectangle(
                        annotated_frame,
                        (x1, y1 - label_h - 10),
                        (x1 + label_w + 10, y1),
                        color,
                        -1
                    )
                    cv2.putText(
                        annotated_frame,
                        label,
                        (x1 + 5, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        font_scale,
                        (255, 255, 255),  # White text
                        label_thickness
                    )
        
        # Update detection state
        self.state.update(bird_detected, max_confidence, self.cooldown_seconds)
        
        return annotated_frame, bird_detected, max_confidence
    
    def process_frame(self) -> Optional[bytes]:
        """
        Read and process a single frame, returning JPEG bytes.
        
        Returns:
            JPEG encoded frame bytes, or None if no frame available
        """
        ret, frame = self.read_frame()
        
        if not ret or frame is None:
            return None
            
        # Detect and annotate
        annotated_frame, _, _ = self.detect_birds(frame)
        
        # Encode to JPEG
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 85]
        _, jpeg = cv2.imencode('.jpg', annotated_frame, encode_params)
        
        return jpeg.tobytes()
    
    def get_status(self) -> dict:
        """Get current detection status as dictionary"""
        return self.state.to_dict()
    
    @property
    def has_source(self) -> bool:
        """Check if a video source is currently set"""
        with self._video_lock:
            return self._video_source is not None and self._video_source.isOpened()
