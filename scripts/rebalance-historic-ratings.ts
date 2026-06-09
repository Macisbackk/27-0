/**
 * Historic rating boost helper (idempotent).
 * Boost tiers from international caps: 15+ → +4, 8+ → +3, 3+ → +2, else +1.
 * Data in historic-players.json was rebalanced in task 253 — re-run is a no-op
 * unless raw ratings are reset.
 *
 * Run: npx tsx scripts/rebalance-historic-ratings.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type HistoricPlayer = {
  id: string;
  name: string;
  peakRating: number;
  rating?: number;
  value: number;
  intlCaps?: number;
  category: string;
};

const path = join(__dirname, "..", "data", "historic-players.json");

function ratingToValue(rating: number): number {
  if (rating >= 95) return Math.round((500_000 + ((rating - 95) / 4) * 250_000) / 1000) * 1000;
  if (rating >= 90) return Math.round((250_000 + ((rating - 90) / 4) * 250_000) / 1000) * 1000;
  if (rating >= 85) return Math.round((150_000 + ((rating - 85) / 4) * 130_000) / 1000) * 1000;
  if (rating >= 80) return Math.round((90_000 + ((rating - 80) / 4) * 90_000) / 1000) * 1000;
  if (rating >= 75) return Math.round((45_000 + ((rating - 75) / 4) * 55_000) / 1000) * 1000;
  return Math.round((20_000 + ((rating - 70) / 4) * 30_000) / 1000) * 1000;
}

export function boostFromCaps(intlCaps: number): number {
  if (intlCaps >= 15) return 4;
  if (intlCaps >= 8) return 3;
  if (intlCaps >= 3) return 2;
  return 1;
}

const players = JSON.parse(readFileSync(path, "utf-8")) as HistoricPlayer[];
const changes: { name: string; from: number; to: number; boost: number }[] = [];

for (const p of players) {
  if (p.category !== "historic") continue;

  const boost = boostFromCaps(p.intlCaps ?? 0);
  const before = p.peakRating;
  const after = Math.min(96, before + boost);

  if (after === before) continue;

  p.peakRating = after;
  p.rating = after;
  p.value = ratingToValue(after);
  changes.push({ name: p.name, from: before, to: after, boost });
}

if (changes.length > 0) {
  writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
}

console.log(`Updated ${changes.length} historic players`);
for (const c of changes.slice(0, 25)) {
  console.log(`  ${c.name}: ${c.from} → ${c.to} (+${c.boost})`);
}
