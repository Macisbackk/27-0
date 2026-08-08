/**
 * Resize resources/icon.png (+ splash) into Android mipmap / drawable folders.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const RES = path.join(ROOT, "android", "app", "src", "main", "res");
const ICON = path.join(ROOT, "resources", "icon.png");
const FG = path.join(ROOT, "resources", "icon-foreground.png");
const SPLASH = path.join(ROOT, "resources", "splash.png");

const LAUNCHER: Record<string, number> = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const FOREGROUND: Record<string, number> = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const SPLASH_PORT: Record<string, number> = {
  "drawable-port-mdpi": 320,
  "drawable-port-hdpi": 480,
  "drawable-port-xhdpi": 720,
  "drawable-port-xxhdpi": 1080,
  "drawable-port-xxxhdpi": 1440,
};

const SPLASH_LAND: Record<string, number> = {
  "drawable-land-mdpi": 480,
  "drawable-land-hdpi": 800,
  "drawable-land-xhdpi": 1280,
  "drawable-land-xxhdpi": 1600,
  "drawable-land-xxxhdpi": 1920,
};

async function writeSquare(src: string, dest: string, size: number) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(src).resize(size, size).png().toFile(dest);
}

async function writeSplash(destDir: string, width: number, height: number) {
  fs.mkdirSync(path.join(RES, destDir), { recursive: true });
  await sharp(SPLASH)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(RES, destDir, "splash.png"));
}

async function main() {
  if (!fs.existsSync(ICON) || !fs.existsSync(SPLASH)) {
    throw new Error("Run npm run icons:mobile first");
  }

  for (const [dir, size] of Object.entries(LAUNCHER)) {
    await writeSquare(ICON, path.join(RES, dir, "ic_launcher.png"), size);
    await writeSquare(ICON, path.join(RES, dir, "ic_launcher_round.png"), size);
  }
  for (const [dir, size] of Object.entries(FOREGROUND)) {
    await writeSquare(FG, path.join(RES, dir, "ic_launcher_foreground.png"), size);
  }

  // Default splash drawable
  await sharp(SPLASH)
    .resize(1080, 1920, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(RES, "drawable", "splash.png"));

  for (const [dir, w] of Object.entries(SPLASH_PORT)) {
    const h = Math.round(w * (16 / 9));
    await writeSplash(dir, w, h);
  }
  for (const [dir, w] of Object.entries(SPLASH_LAND)) {
    const h = Math.round(w * (9 / 16));
    await writeSplash(dir, w, h);
  }

  console.log("Android icons + splash applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
