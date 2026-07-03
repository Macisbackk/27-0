/**
 * Rebalance peakRating and value across all player JSON files (70–94 scale).
 * Elite (91+) stays rare; manual overrides are preserved.
 * Run: npm run rebalance:ratings
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";

type RawPlayer = Record<string, unknown> & {
  id: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  category?: string;
};

const DATA_DIR = join(__dirname, "..", "data");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"];

type RatingBand =
  | "filler"
  | "fringe"
  | "rotation"
  | "reliable"
  | "strong"
  | "top"
  | "elite"
  | "legendary";

/** Target bands aligned with Super League tier spread. */
const OUTPUT_RANGES: Record<RatingBand, [number, number]> = {
  filler: [70, 73],
  fringe: [74, 77],
  rotation: [78, 81],
  reliable: [82, 84],
  strong: [85, 87],
  top: [88, 90],
  elite: [91, 94],
  legendary: [95, 99],
};

function getBand(category: string, raw: number): RatingBand {
  if (category === "legend") {
    if (raw >= 97) return "legendary";
    if (raw >= 93) return "elite";
    if (raw >= 88) return "top";
    return "strong";
  }
  if (raw >= 92) return "elite";
  if (raw >= 88) return "top";
  if (raw >= 85) return "strong";
  if (raw >= 82) return "reliable";
  if (raw >= 78) return "rotation";
  if (raw >= 74) return "fringe";
  return "filler";
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
    result = Math.max(88, Math.min(99, result));
  } else if (category === "historic") {
    result = Math.max(74, Math.min(94, result));
  } else {
    result = Math.max(70, Math.min(90, result));
  }

  return Math.max(70, Math.min(99, result));
}

function ratingToValue(rating: number): number {
  const normalized = (rating - 70) / 29;
  const value = Math.pow(Math.max(0, normalized), 1.9) * 4_800_000 + 100_000;
  return Math.round(value / 5_000) * 5_000;
}

for (const file of FILES) {
  const path = join(DATA_DIR, file);
  const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];

  for (const p of players) {
    if (PLAYER_RATING_OVERRIDES[p.id] !== undefined) continue;
    const raw = (p.peakRating ?? p.rating ?? 80) as number;
    const category = (p.category as string) ?? "current";
    let newRating = compress(raw, category);
    if (p.id === "bradford-cur-joe-mellor") newRating = 88;
    p.peakRating = newRating;
    p.value = ratingToValue(newRating);
  }

  writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
  console.log(`Updated ${players.length} players in ${file}`);
}

console.log("Rating rebalance complete (70–94 tier scale, 90+ rare).");
