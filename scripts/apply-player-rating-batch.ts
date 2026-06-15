/**
 * Apply batch player rating updates.
 * Run: npx tsx scripts/apply-player-rating-batch.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";

const ROOT = join(__dirname, "..");

const RATINGS: Record<string, number> = {
  "hull-kr-cur-mikey-lewis": 91,
  "leigh-cur-lachlan-lam": 90,
  "hull-fc-cur-aidan-sezer": 87,
  "st-helens-cur-alex-walmsley": 89,
  "leeds-cur-brodie-croft": 88,
  "hull-kr-cur-elliot-minchella": 88,
  "leigh-cur-david-armstrong": 86,
  "hull-fc-cur-john-asiata": 87,
  "wigan-cur-jake-wardle": 90,
  "wigan-cur-junior-nsemba": 89,
  "catalans-cur-luke-keary": 87,
  "wigan-cur-luke-thompson": 89,
  "wigan-cur-adam-keighran": 88,
};

function load<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
}

function save(path: string, data: unknown): void {
  writeFileSync(join(ROOT, path), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const current = load<Record<string, unknown>[]>("data/current-squads.json");
  const overrides = { ...PLAYER_RATING_OVERRIDES };
  const updated: string[] = [];

  for (const p of current) {
    const id = p.id as string;
    const rating = RATINGS[id];
    if (rating === undefined) continue;
    const old = (p.peakRating ?? p.rating) as number;
    p.peakRating = rating;
    p.rating = rating;
    overrides[id] = rating;
    updated.push(`${p.name}: ${old} → ${rating}`);
  }

  const missing = Object.keys(RATINGS).filter(
    (id) => !current.some((p) => p.id === id)
  );
  if (missing.length) {
    console.error("Missing player IDs:", missing.join(", "));
    process.exit(1);
  }

  save("data/current-squads.json", current);
  console.log(`Updated ${updated.length} players:`);
  updated.forEach((u) => console.log(`  ${u}`));
}

main();
