const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const svgPath = path.join(__dirname, '..', 'icon.svg');
  const imagesDir = path.join(__dirname, '..', 'images');
  
  // Ensure images directory exists
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  const sizes = [16, 32, 48, 128];
  
  console.log('Generating extension icons...');
  
  for (const size of sizes) {
    const outputPath = path.join(imagesDir, `extension_${size}.png`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${size}x${size} icon: ${outputPath}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error);
    }
  }
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);