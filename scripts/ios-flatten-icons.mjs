// App Store Connect rejects app icons with an alpha channel (ITMS-90717). @capacitor/assets writes
// RGBA PNGs from resources/, so flatten every iOS app icon onto the brand background.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("ios/App/App/Assets.xcassets/AppIcon.appiconset");
const files = (await readdir(dir)).filter((f) => f.endsWith(".png"));
for (const file of files) {
  const full = path.join(dir, file);
  const out = await sharp(await readFile(full)).flatten({ background: "#0e0f10" }).removeAlpha().png().toBuffer();
  await writeFile(full, out);
  console.log(`flattened ${file}`);
}
