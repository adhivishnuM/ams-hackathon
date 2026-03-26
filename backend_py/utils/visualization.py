"""
Visualization utilities for disease analysis results.
Now uses actual detected disease regions instead of generic color detection.
"""
import cv2
import numpy as np
from PIL import Image
import io
import base64


def draw_disease_regions(image: Image.Image, analysis: dict) -> Image.Image:
    """
    Draw precise bounding boxes around detected disease regions.
    
    Args:
        image: Original PIL Image
        analysis: Detection result containing 'disease_regions' list
        
    Returns:
        PIL Image with disease regions marked
    """
    img_np = np.array(image.convert("RGB"))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    height, width = img_bgr.shape[:2]
    
    disease_regions = analysis.get("disease_regions", [])
    is_healthy = analysis.get("is_healthy", False)
    severity = analysis.get("severity", "medium")
    
    # Color scheme based on severity
    if is_healthy:
        box_color = (46, 204, 113)  # Green - healthy
    elif severity == "high":
        box_color = (52, 73, 235)   # Red (BGR) - severe
    elif severity == "medium":
        box_color = (0, 165, 255)   # Orange (BGR) - medium
    else:
        box_color = (0, 200, 255)   # Yellow (BGR) - low
    
    # Draw boxes around detected disease regions
    for i, region in enumerate(disease_regions):
        x, y, w, h = region["x"], region["y"], region["w"], region["h"]
        conf = region.get("confidence", 75)
        
        # Draw rectangle with thickness based on severity
        thickness = 3 if severity == "high" else 2
        cv2.rectangle(img_bgr, (x, y), (x + w, y + h), box_color, thickness)
        
        # Add label
        label = f"#{i+1} ({conf:.0f}%)"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        (label_w, label_h), _ = cv2.getTextSize(label, font, font_scale, 1)
        
        # Background for label
        label_y = max(y - 5, label_h + 5)
        cv2.rectangle(img_bgr, (x, label_y - label_h - 4), (x + label_w + 4, label_y + 2), box_color, -1)
        cv2.putText(img_bgr, label, (x + 2, label_y - 2), font, font_scale, (255, 255, 255), 1)
    
    # If healthy, add a single "Healthy" badge at top
    if is_healthy:
        badge_text = "HEALTHY"
        font = cv2.FONT_HERSHEY_SIMPLEX
        (badge_w, badge_h), _ = cv2.getTextSize(badge_text, font, 0.8, 2)
        badge_x = (width - badge_w) // 2
        badge_y = 40
        cv2.rectangle(img_bgr, (badge_x - 10, badge_y - badge_h - 10), (badge_x + badge_w + 10, badge_y + 10), (46, 204, 113), -1)
        cv2.putText(img_bgr, badge_text, (badge_x, badge_y), font, 0.8, (255, 255, 255), 2)
    
    # If no disease regions detected but not healthy, show subtle border indicator
    if not is_healthy and not disease_regions:
        # Draw a subtle border instead of scan lines
        border_thickness = 4
        cv2.rectangle(img_bgr, (border_thickness, border_thickness), 
                     (width - border_thickness, height - border_thickness), 
                     box_color, border_thickness)
        
        # Add analysis indicator badge at bottom
        text = "SYMPTOMS DETECTED"
        font = cv2.FONT_HERSHEY_SIMPLEX
        (text_w, text_h), _ = cv2.getTextSize(text, font, 0.6, 2)
        text_x = (width - text_w) // 2
        text_y = height - 20
        cv2.rectangle(img_bgr, (text_x - 8, text_y - text_h - 6), (text_x + text_w + 8, text_y + 6), box_color, -1)
        cv2.putText(img_bgr, text, (text_x, text_y), font, 0.6, (255, 255, 255), 2)
    
    # Convert back to RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(img_rgb)


def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def process_and_visualize(image: Image.Image, analysis: dict) -> tuple:
    """
    Main entry point: visualize detection results on image.
    
    Returns:
        (processed_image, base64_string)
    """
    processed = draw_disease_regions(image, analysis)
    b64 = image_to_base64(processed)
    return processed, b64
