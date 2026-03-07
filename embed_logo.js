
const fs = require('fs');
const path = require('path');

const pngPath = path.resolve('d:\\agrotalk-assist\\public\\logo_raw.png');
const svgPath = path.resolve('d:\\agrotalk-assist\\public\\logo.svg');

try {
    const bitmap = fs.readFileSync(pngPath);
    const base64Image = Buffer.from(bitmap).toString('base64');

    const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
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
    href="data:image/png;base64,${base64Image}" 
    clip-path="url(#circleClip)"
  />
</svg>`;

    fs.writeFileSync(svgPath, svgContent);
    console.log(`Successfully embedded PNG into ${svgPath}`);
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
