/**
 * Rebalance peakRating and value across all player JSON files.
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

type RatingTier = "legend" | "elite" | "strong" | "solid" | "squad";

const TIER_RANGES: Record<RatingTier, [number, number]> = {
  legend: [88, 95],
  elite: [85, 92],
  strong: [82, 88],
  solid: [78, 85],
  squad: [75, 82],
};

function getTier(category: string, raw: number): RatingTier {
  if (category === "legend") return "legend";
  if (raw >= 88) return "elite";
  if (raw >= 84) return "strong";
  if (raw >= 78) return "solid";
  return "squad";
}

function compress(raw: number, category: string): number {
  const tier = getTier(category, raw);
  const [min, max] = TIER_RANGES[tier];
  const bounds: Record<string, [number, number]> = {
    current: [66, 93],
    historic: [70, 96],
    legend: [85, 98],
  };
  const [oldMin, oldMax] = bounds[category] ?? [66, 98];
  const clamped = Math.max(oldMin, Math.min(oldMax, raw));
  const t = (clamped - oldMin) / (oldMax - oldMin);
  let compressed = Math.max(70, Math.min(95, Math.round(min + t * (max - min))));
  if (category === "current") compressed = Math.max(75, compressed);
  return compressed;
}

function ratingToValue(rating: number): number {
  const normalized = (rating - 70) / 25;
  const value = Math.pow(normalized, 1.85) * 4_800_000 + 120_000;
  return Math.round(value / 5_000) * 5_000;
}

for (const file of FILES) {
  const path = join(DATA_DIR, file);
  const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];

  for (const p of players) {
    const raw = (p.peakRating ?? p.rating ?? 75) as number;
    const category = (p.category as string) ?? "current";
    let newRating = compress(raw, category);
    if (p.id === "bradford-cur-joe-mellor") newRating = 99;
    p.peakRating = newRating;
    p.rating = newRating;
    p.value = ratingToValue(newRating);
  }

  writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
  console.log(`Updated ${players.length} players in ${file}`);
}

console.log("Rating rebalance complete.");
