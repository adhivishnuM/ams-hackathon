"""
Image processing utilities.
"""
import base64
import io
from PIL import Image
import numpy as np

def decode_base64_image(image_data: str) -> Image.Image:
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image

def preprocess_image(image: Image.Image, target_size: tuple = (224, 224)) -> Image.Image:
    image = image.resize(target_size, Image.Resampling.LANCZOS)
    return image

def resize_for_ai(image: Image.Image, max_dim: int = 1024) -> Image.Image:
    """Resizes image maintaining aspect ratio, ensuring no dimension exceeds max_dim."""
    w, h = image.size
    if max(w, h) > max_dim:
        if w > h:
            new_w = max_dim
            new_h = int(h * (max_dim / w))
        else:
            new_h = max_dim
            new_w = int(w * (max_dim / h))
        return image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return image

def image_to_base64(image: Image.Image, format: str = "JPEG", quality: int = 85) -> str:
    """Converts PIL image to base64 string."""
    buffered = io.BytesIO()
    image.save(buffered, format=format, quality=quality)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def image_to_numpy(image: Image.Image) -> np.ndarray:
    arr = np.array(image, dtype=np.float32)
    arr = arr / 255.0
    return arr
