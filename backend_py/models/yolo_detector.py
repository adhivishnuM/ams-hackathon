"""
Plant Disease Detector - Color-Based Detection for Lemons and Leaves.
Simplified, reliable detection using OpenCV color analysis.
Detects: Lemon (Healthy/Spoiled), Leaf (Good/Bad)
"""
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from PIL import Image
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None


class PlantDiseaseDetector:
    """
    Real-time plant detector using color analysis.
    - Green dominant = Leaf
    - Yellow dominant = Lemon  
    - Brown/dark spots = Spoiled/Bad
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = True  # Backward compatibility
        self.disease_info = self._load_disease_info()
        
        # API Compatibility attributes for main.py
        self.names = {0: "Healthy", 1: "Disease Detected"}
        self.TARGET_CLASSES = ["Healthy Lemon", "Spoiled Lemon", "Good Leaf", "Bad Leaf", "Other"]
        
        print("🌱 PlantDiseaseDetector initialized (Color-based mode)")
    
    def _load_disease_info(self) -> dict:
        data_path = Path(__file__).parent.parent / "data" / "disease_info.json"
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}

    def detect(self, image: Image.Image) -> Optional[Dict[str, Any]]:
        """
        Main detection method. Analyzes colors to identify Leaf or Lemon.
        Returns dict with detection info, or None if nothing detected.
        """
        if cv2 is None:
            return None
            
        # Convert PIL to OpenCV
        img_np = np.array(image.convert("RGB"))
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        height, width = img_bgr.shape[:2]
        total_pixels = width * height
        
        # Convert to HSV for color analysis
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        
        # ========== COLOR DETECTION ==========
        
        # GREEN (Leaves): Hue 35-85, decent saturation and value
        green_mask = cv2.inRange(hsv, np.array([35, 40, 40]), np.array([85, 255, 255]))
        green_pixels = np.sum(green_mask > 0)
        green_ratio = green_pixels / total_pixels
        
        # YELLOW (Lemons): Hue 15-40, flexible saturation
        yellow_mask = cv2.inRange(hsv, np.array([15, 40, 40]), np.array([40, 255, 255]))
        yellow_pixels = np.sum(yellow_mask > 0)
        yellow_ratio = yellow_pixels / total_pixels
        
        # BROWN (Spoilage): Hue 5-20, medium saturation, lower value
        brown_mask = cv2.inRange(hsv, np.array([5, 30, 20]), np.array([20, 180, 150]))
        brown_pixels = np.sum(brown_mask > 0)
        brown_ratio = brown_pixels / total_pixels
        
        # DARK SPOTS (Rot): Very low brightness
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        _, dark_mask = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY_INV)
        dark_ratio = np.sum(dark_mask > 0) / total_pixels
        
        # ========== DETECTION LOGIC ==========
        
        # Minimum threshold: at least 1% of frame should have the color
        MIN_THRESHOLD = 0.01
        
        category = None
        confidence = 0.0
        
        # Priority 1: Detect LEAF if significant green
        if green_ratio > MIN_THRESHOLD:
            category = "Leaf"
            confidence = min(95, 30 + green_ratio * 200)
            
        # Priority 2: Detect LEMON if significant yellow (and not mostly green)
        if yellow_ratio > MIN_THRESHOLD and yellow_ratio > green_ratio:
            category = "Lemon"
            confidence = min(95, 30 + yellow_ratio * 200)
        
        # If nothing detected, return None
        if category is None:
            return None
        
        # ========== HEALTH ANALYSIS ==========
        
        # Calculate health based on brown/dark areas relative to detected object
        if category == "Leaf":
            # For leaves: brown or yellowing indicates bad
            damage_ratio = brown_ratio + (dark_ratio * 0.5)
            is_healthy = damage_ratio < 0.02 and green_ratio > brown_ratio * 3
        else:  # Lemon
            # For lemons: dark spots or heavy brown indicates spoiled
            damage_ratio = dark_ratio + (brown_ratio * 0.3)
            is_healthy = damage_ratio < 0.03
        
        # ========== DETERMINE STATUS ==========
        
        if category == "Leaf":
            if is_healthy:
                disease_name = "Good Leaf"
            else:
                disease_name = "Bad Leaf"
        else:  # Lemon
            if is_healthy:
                disease_name = "Healthy Lemon"
            else:
                disease_name = "Spoiled Lemon"
        
        # ========== FIND DISEASE REGIONS ==========
        
        disease_mask = cv2.bitwise_or(brown_mask, dark_mask)
        contours, _ = cv2.findContours(disease_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        regions = []
        for cnt in contours:
            if cv2.contourArea(cnt) > (total_pixels * 0.003):  # 0.3% minimum
                x, y, w, h = cv2.boundingRect(cnt)
                regions.append({"x": x, "y": y, "w": w, "h": h})
        
        return {
            "disease_name": disease_name,
            "crop_identified": category,
            "confidence": round(float(confidence), 1),
            "is_healthy": is_healthy,
            "analysis_details": {
                "health_score": damage_ratio,
                "is_healthy": is_healthy,
                "green_ratio": round(green_ratio, 4),
                "yellow_ratio": round(yellow_ratio, 4),
                "brown_ratio": round(brown_ratio, 4),
                "dark_ratio": round(dark_ratio, 4),
                "dominant_issue": "healthy" if is_healthy else "spoilage"
            },
            "disease_regions": regions
        }
