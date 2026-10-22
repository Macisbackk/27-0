/**
 * Generate the 27-0 app icons, PWA icons and splash, matching the Matchnight LogoMark:
 * two lit scoreboard panels ("27" and "0") on neutral black, digits in floodlit lime.
 * Digits are drawn as seven-segment bars, so no font is needed to render them.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const RESOURCES = path.join(ROOT, "resources");
const PUBLIC_ICONS = path.join(ROOT, "public", "icons");

const BG = "#0e0f10";
const PANEL = "#060707";
const PANEL_EDGE = "#383b3f";
const DIGIT = "#b6f23d";
const DASH = "#ffffff";

//           a  b  c  d  e  f  g
const SEGMENTS: Record<string, number[]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
};

/** One seven-segment digit at (x, y), u wide and 1.8u tall. */
function digit(ch: string, x: number, y: number, u: number): string {
  const on = SEGMENTS[ch]!;
  const h = u * 1.8;
  const t = u * 0.3;
  const r = t * 0.35;
  const s = t * 0.14; // the small gap between neighbouring segments
  const half = h / 2;
  const hw = u - t - 2 * s; // horizontal bar length
  const vh = half - t / 2 - 2 * s; // vertical bar length
  const bars = [
    [x + t / 2 + s, y, hw, t], // a
    [x + u - t, y + t / 2 + s, t, vh], // b
    [x + u - t, y + half + s, t, vh], // c
    [x + t / 2 + s, y + h - t, hw, t], // d
    [x, y + half + s, t, vh], // e
    [x, y + t / 2 + s, t, vh], // f
    [x + t / 2 + s, y + half - t / 2, hw, t], // g
  ];
  return bars
    .map(([bx, by, bw, bh], i) =>
      on[i] ? `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}" fill="${DIGIT}"/>` : ""
    )
    .join("");
}

/** The two-panel mark, centred at (cx, cy), `width` wide. */
function mark(cx: number, cy: number, width: number): string {
  const u = width / 5.28;
  const pad = u * 0.32;
  const gap = u * 0.3;
  const dh = u * 1.8;
  const ph = dh + pad * 2;
  const p1w = u * 2 + gap + pad * 2;
  const p2w = u + pad * 2;
  const dashW = u * 0.7;
  const left = cx - width / 2;
  const top = cy - ph / 2;
  const radius = u * 0.12;
  const edge = Math.max(1, u * 0.04);
  const p2x = left + p1w + dashW;
  const panel = (x: number, w: number) =>
    `<rect x="${x}" y="${top}" width="${w}" height="${ph}" rx="${radius}" fill="${PANEL}" stroke="${PANEL_EDGE}" stroke-width="${edge}"/>` +
    `<rect x="${x}" y="${cy - edge / 2}" width="${w}" height="${edge}" fill="#000" fill-opacity="0.55"/>`;
  return [
    panel(left, p1w),
    panel(p2x, p2w),
    digit("2", left + pad, top + pad, u),
    digit("7", left + pad + u + gap, top + pad, u),
    digit("0", p2x + pad, top + pad, u),
    `<rect x="${left + p1w + dashW * 0.22}" y="${cy - u * 0.08}" width="${dashW * 0.56}" height="${u * 0.16}" rx="${u * 0.04}" fill="${DASH}"/>`,
  ].join("");
}

const DEFS = `<defs>
  <radialGradient id="flood" cx="50%" cy="-10%" r="85%">
    <stop offset="0%" stop-color="#b6f23d" stop-opacity="0.16"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
</defs>`;

/** Square icon. `contentWidth` is the fraction of the square the mark spans (smaller for maskable). */
function iconSvg(size: number, opts: { transparent?: boolean; contentWidth?: number } = {}): string {
  const transparent = opts.transparent ?? false;
  const contentWidth = opts.contentWidth ?? 0.8;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${DEFS}
  ${transparent ? "" : `<rect width="${size}" height="${size}" fill="${BG}"/><rect width="${size}" height="${size}" fill="url(#flood)"/>`}
  ${mark(size / 2, size / 2, size * contentWidth)}
</svg>`;
}

function splashSvg(width: number, height: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${DEFS}
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <rect width="${width}" height="${height}" fill="url(#flood)"/>
  ${mark(width / 2, height / 2, Math.min(width, height) * 0.36)}
</svg>`;
}

async function writePngFromSvg(filePath: string, svg: string, flatten = false) {
  let img = sharp(Buffer.from(svg));
  if (flatten) img = img.flatten({ background: BG });
  await img.png().toFile(filePath);
  console.log("wrote", path.relative(ROOT, filePath));
}

async function main() {
  fs.mkdirSync(RESOURCES, { recursive: true });
  fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

  // App store / PWA full icons
  await writePngFromSvg(path.join(RESOURCES, "icon.png"), iconSvg(1024));
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-192.png"), iconSvg(192));
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-512.png"), iconSvg(512));
  await writePngFromSvg(path.join(PUBLIC_ICONS, "apple-touch-icon.png"), iconSvg(180, { contentWidth: 0.74 }), true);

  // Maskable: the mark stays inside the central safe circle.
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-maskable-192.png"), iconSvg(192, { contentWidth: 0.6 }), true);
  await writePngFromSvg(path.join(PUBLIC_ICONS, "icon-maskable-512.png"), iconSvg(512, { contentWidth: 0.6 }), true);

  // Android adaptive foreground (transparent) + background
  await writePngFromSvg(
    path.join(RESOURCES, "icon-foreground.png"),
    iconSvg(1024, { transparent: true, contentWidth: 0.56 })
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
