// Run with: node generate-icons.js
// Requires: npm install canvas (or use the built-in canvas in Node 18+)
// Alternatively open generate-icons.html in a browser to download the icons

const { createCanvas } = require('canvas');
const fs = require('fs');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Cookie emoji approximation
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍪', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

[16, 48, 128].forEach(size => {
  fs.writeFileSync(`icons/icon${size}.png`, createIcon(size));
  console.log(`icons/icon${size}.png created`);
});
