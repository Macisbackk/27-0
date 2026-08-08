/**
 * Generate Capacitor / Android launcher + splash assets from the 27-0 brand colours.
 * Logo in-app is a CSS wordmark; native icons use a dark pitch + green "27-0" mark.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const RESOURCES = path.join(ROOT, "resources");
const PUBLIC_ICONS = path.join(ROOT, "public", "icons");

const BG = "#0a0f0d";
const ACCENT = "#22c55e";

function wordmarkSvg(size: number, padRatio = 0.14): string {
  const pad = Math.round(size * padRatio);
  const fontSize = Math.round(size * 0.34);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}"
    font-weight="900" fill="${ACCENT}" letter-spacing="-0.04em">27-0</text>
  <rect x="${pad}" y="${size - pad - 6}" width="${size - pad * 2}" height="6" rx="3" fill="${ACCENT}" opacity="0.85"/>
</svg>`;
}

async function writePng(filePath: string, size: number, padRatio?: number) {
  const svg = Buffer.from(wordmarkSvg(size, padRatio));
  await sharp(svg).png().toFile(filePath);
  console.log("wrote", path.relative(ROOT, filePath));
}

async function main() {
  fs.mkdirSync(RESOURCES, { recursive: true });
  fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

  await writePng(path.join(RESOURCES, "icon.png"), 1024, 0.18);
  await writePng(path.join(RESOURCES, "icon-foreground.png"), 1024, 0.22);
  await writePng(path.join(RESOURCES, "splash.png"), 2732, 0.32);
  await writePng(path.join(PUBLIC_ICONS, "icon-192.png"), 192);
  await writePng(path.join(PUBLIC_ICONS, "icon-512.png"), 512);

  // Solid background for adaptive icon
  const bgSvg = Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`
  );
  await sharp(bgSvg)
    .png()
    .toFile(path.join(RESOURCES, "icon-background.png"));
  console.log("wrote resources/icon-background.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
