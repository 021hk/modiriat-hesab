// ساخت آیکون‌های PWA با sharp
import sharp from "sharp";

const svg = String.raw`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(96,116)">
    <rect x="0" y="60" width="320" height="220" rx="36" fill="#ffffff"/>
    <path d="M 0 100 L 0 60 Q 0 24 36 24 L 250 24 Q 286 24 286 60 L 286 100 Z" fill="#d1fae5"/>
    <circle cx="256" cy="170" r="34" fill="#059669"/>
    <circle cx="256" cy="170" r="14" fill="#ffffff"/>
    <path d="M 40 280 L 120 280" stroke="#059669" stroke-width="24" stroke-linecap="round"/>
  </g>
</svg>`;

async function main() {
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("/home/z/my-project/public/icon-512.png");
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile("/home/z/my-project/public/icon-192.png");
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile("/home/z/my-project/public/apple-touch-icon.png");
  console.log("icons created");
}

main();
