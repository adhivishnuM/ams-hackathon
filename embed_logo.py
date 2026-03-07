
import base64
import os

png_path = r'd:\agrotalk-assist\public\logo_raw.png'
svg_path = r'd:\agrotalk-assist\public\logo.svg'

with open(png_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

svg_content = f'''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <clipPath id="circleClip">
      <circle cx="256" cy="256" r="256" />
    </clipPath>
  </defs>
  
  <!-- Subtle NVIDIA Green outer ring -->
  <circle cx="256" cy="256" r="250" stroke="#76B900" stroke-width="12" stroke-opacity="0.5" />
  
  <!-- The Image masked into a circle -->
  <image 
    width="512" 
    height="512" 
    href="data:image/png;base64,{encoded_string}" 
    clip-path="url(#circleClip)"
  />
</svg>'''

with open(svg_path, "w") as svg_file:
    svg_file.write(svg_content)

print(f"Successfully embedded PNG into {svg_path}")
