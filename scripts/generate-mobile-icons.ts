/**
 * Generate Capacitor / Android launcher + splash assets matching the 27-0 LogoMark.
 * Wordmark: green 27, soft dash, light 0 — on dark pitch with a soft oval badge.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const RESOURCES = path.join(ROOT, "resources");
const PUBLIC_ICONS = path.join(ROOT, "public", "icons");

const BG = "#0a0f0d";
const GREEN = "#22c55e";
const GREEN_SOFT = "#4ade80";
const WHITE = "#f3f4f6";
const PITCH_LINE = "#1a2e24";

/**
 * Full square app icon (legacy launchers / PWA).
 * `safePad` keeps the mark inside Android adaptive safe zone (~66% centre).
 */
function iconSvg(size: number, opts: { transparent?: boolean; safePad?: number } = {}): string {
  const transparent = opts.transparent ?? false;
  const safePad = opts.safePad ?? 0.18;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * (0.5 - safePad * 0.35);
  const innerR = outerR * 0.82;
  const fontSize = Math.round(size * 0.28);
  const underlineY = cy + fontSize * 0.42;
  const underlineW = size * (1 - safePad * 2) * 0.72;
  const underlineH = Math.max(4, Math.round(size * 0.012));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="${GREEN}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="underline" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="55%" stop-color="${GREEN_SOFT}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="${GREEN_SOFT}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  ${
    transparent
      ? ""
      : `<rect width="${size}" height="${size}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="url(#glow)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${outerR * 0.92}" ry="${outerR * 0.72}" fill="none" stroke="${PITCH_LINE}" stroke-width="${Math.max(2, size * 0.012)}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${innerR * 0.92}" ry="${innerR * 0.72}" fill="none" stroke="url(#ring)" stroke-width="${Math.max(3, size * 0.018)}"/>`
  }
  ${
    transparent
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${outerR * 0.9}" ry="${outerR * 0.7}" fill="${BG}" fill-opacity="0.92"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${outerR * 0.9}" ry="${outerR * 0.7}" fill="none" stroke="url(#ring)" stroke-width="${Math.max(3, size * 0.02)}"/>`
      : ""
  }
  <text x="${cx}" y="${cy + fontSize * 0.08}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Black, Impact, Haettenschweiler, sans-serif" font-size="${fontSize}"
    font-weight="900" letter-spacing="-0.06em">
    <tspan fill="${GREEN}">27</tspan><tspan fill="${GREEN_SOFT}" dx="-0.02em">-</tspan><tspan fill="${WHITE}">0</tspan>
  </text>
  <rect x="${cx - underlineW / 2}" y="${underlineY}" width="${underlineW}" height="${underlineH}" rx="${underlineH / 2}" fill="url(#underline)"/>
</svg>`;
}

function splashSvg(width: number, height: number): string {
  const cx = width / 2;
  const cy = height / 2;
  const mark = Math.min(width, height) * 0.22;
  const fontSize = Math.round(mark * 0.9);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="splashGlow" cx="50%" cy="46%" r="40%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="splashLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0"/>
      <stop offset="35%" stop-color="${GREEN}"/>
      <stop offset="65%" stop-color="${GREEN_SOFT}"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * 0.35}" fill="url(#splashGlow)"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Black, Impact, Haettenschweiler, sans-serif" font-size="${fontSize}"
    font-weight="900" letter-spacing="-0.06em">
    <tspan fill="${GREEN}">27</tspan><tspan fill="${GREEN_SOFT}">-</tspan><tspan fill="${WHITE}">0</tspan>
  </text>
  <rect x="${cx - mark * 1.1}" y="${cy + fontSize * 0.45}" width="${mark * 2.2}" height="${Math.max(4, height * 0.004)}" rx="2" fill="url(#splashLine)"/>
</svg>`;
}

async function writePngFromSvg(filePath: string, svg: string) {
  await sharp(Buffer.from(svg)).png().toFile(filePath);
  console.log("wrote", path.relative(ROOT, filePath));
}

async function main() {
  fs.mkdirSync(RESOURCES, { recursive: true });
  fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

  // Legacy / PWA full icons
  await writePngFromSvg(path.join(RESOURCES, "icon.png"), iconSvg(1024));
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-192.png"), iconSvg(192));
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-512.png"), iconSvg(512));

  // Adaptive foreground: more padding so the mark survives circular masks
  await writePngFromSvg(
    path.join(RESOURCES, "icon-foreground.png"),
    iconSvg(1024, { transparent: true, safePad: 0.22 })
  );

  await writePngFromSvg(path.join(RESOURCES, "splash.png"), splashSvg(2732, 2732));

  const bgSvg = Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`
  );
  await sharp(bgSvg).png().toFile(path.join(RESOURCES, "icon-background.png"));
  console.log("wrote resources/icon-background.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
