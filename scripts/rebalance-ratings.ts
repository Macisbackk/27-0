/**
 * Rebalance peakRating and value across all player JSON files (75–99 scale).
 * Run: npm run rebalance:ratings
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type RawPlayer = Record<string, unknown> & {
  id: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  category?: string;
};

const DATA_DIR = join(__dirname, "..", "data");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"];

type RatingBand = "lower" | "regular" | "strong" | "elite" | "legendary";

const OUTPUT_RANGES: Record<RatingBand, [number, number]> = {
  lower: [75, 79],
  regular: [80, 84],
  strong: [85, 89],
  elite: [90, 94],
  legendary: [95, 99],
};

function getBand(category: string, raw: number): RatingBand {
  if (category === "legend") {
    if (raw >= 97) return "legendary";
    if (raw >= 93) return "elite";
    return "strong";
  }
  if (raw >= 92) return "elite";
  if (raw >= 86) return "strong";
  if (raw >= 80) return "regular";
  return "lower";
}

function compress(raw: number, category: string): number {
  const band = getBand(category, raw);
  const [outMin, outMax] = OUTPUT_RANGES[band];

  const bounds: Record<string, [number, number]> = {
    current: [66, 93],
    historic: [70, 96],
    legend: [88, 99],
  };
  const [inMin, inMax] = bounds[category] ?? [66, 98];
  const clamped = Math.max(inMin, Math.min(inMax, raw));
  const t = (clamped - inMin) / (inMax - inMin);
  let result = Math.round(outMin + t * (outMax - outMin));

  if (category === "legend") {
    result = Math.max(92, Math.min(99, result));
  } else if (category === "historic") {
    result = Math.max(78, Math.min(94, result));
  } else {
    result = Math.max(75, Math.min(88, result));
  }

  return Math.max(75, Math.min(99, result));
}

function ratingToValue(rating: number): number {
  const normalized = (rating - 75) / 24;
  const value = Math.pow(normalized, 1.85) * 4_800_000 + 120_000;
  return Math.round(value / 5_000) * 5_000;
}

for (const file of FILES) {
  const path = join(DATA_DIR, file);
  const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];

  for (const p of players) {
    const raw = (p.peakRating ?? p.rating ?? 80) as number;
    const category = (p.category as string) ?? "current";
    let newRating = compress(raw, category);
    if (p.id === "bradford-cur-joe-mellor") newRating = 88;
    p.peakRating = newRating;
    p.rating = newRating;
    p.value = ratingToValue(newRating);
  }

  writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
  console.log(`Updated ${players.length} players in ${file}`);
}

console.log("Rating rebalance complete (75–99 scale).");
