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

def image_to_numpy(image: Image.Image) -> np.ndarray:
    arr = np.array(image, dtype=np.float32)
    arr = arr / 255.0
    return arr
