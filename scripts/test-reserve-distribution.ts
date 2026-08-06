/**
 * Reserve rating distribution simulation (1000 generations).
 *
 * Run: npx tsx scripts/test-reserve-distribution.ts
 */
import {
  generateReservePlayer,
  RESERVE_RATING_BANDS,
} from "../src/lib/manager/managerReserves";
import { RESERVE_MIN_RATING } from "../src/lib/players/rating-floors";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import type { Position } from "../src/lib/types";

const GENERATIONS = 1000;
const PLAYERS_PER_GEN = 24;
const POSITIONS: Position[] = [
  "FULLBACK",
  "WING",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

const TARGET_BANDS = [
  { label: "65-67", min: 65, max: 67, target: 0.25 },
  { label: "68-70", min: 68, max: 70, target: 0.35 },
  { label: "71-73", min: 71, max: 73, target: 0.25 },
  { label: "74-76", min: 74, max: 76, target: 0.1 },
  { label: "77-79", min: 77, max: 79, target: 0.04 },
  { label: "80-82", min: 80, max: 82, target: 0.01 },
] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function pct(part: number, total: number): string {
  return ((part / total) * 100).toFixed(1);
}

const ratings: number[] = [];

for (let i = 0; i < GENERATIONS; i++) {
  const seed = `reserve-dist-${i}`;
  const club = CURRENT_PLAYABLE_CLUBS[i % CURRENT_PLAYABLE_CLUBS.length]!;
  for (let j = 0; j < PLAYERS_PER_GEN; j++) {
    const position = POSITIONS[j % POSITIONS.length]!;
    ratings.push(generateReservePlayer(seed, j, position, club).rating);
  }
}

const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
const med = median(ratings);
const min = Math.min(...ratings);
const max = Math.max(...ratings);

console.log("Reserve rating distribution simulation");
console.log("=".repeat(44));
console.log(`Generations: ${GENERATIONS}`);
console.log(`Players per generation: ${PLAYERS_PER_GEN}`);
console.log(`Total samples: ${ratings.length}`);
console.log(`Configured bands: ${RESERVE_RATING_BANDS.map((b) => `${b.min}-${b.max}@${(b.weight * 100).toFixed(0)}%`).join(", ")}`);
console.log(`Floor constant: ${RESERVE_MIN_RATING}`);
console.log("");
console.log(`Mean:   ${mean.toFixed(2)}  (target 69–71)`);
console.log(`Median: ${med.toFixed(1)}`);
console.log(`Min:    ${min}`);
console.log(`Max:    ${max}`);
console.log("");
console.log("Band distribution:");

let failed = 0;
for (const band of TARGET_BANDS) {
  const count = ratings.filter(
    (rating) => rating >= band.min && rating <= band.max
  ).length;
  const share = count / ratings.length;
  const delta = Math.abs(share - band.target);
  // Tighter absolute tolerance for the small tail bands (80+ must stay rare).
  const tolerance = Math.max(0.02, Math.min(0.06, band.target * 0.6));
  const ok = delta <= tolerance;
  if (!ok) failed++;
  console.log(
    `  ${band.label}: ${pct(count, ratings.length)}% (${count}) target ~${(band.target * 100).toFixed(0)}% ${ok ? "OK" : "WARN"}`
  );
}

const belowFloor = ratings.filter((rating) => rating < RESERVE_MIN_RATING).length;
const aboveCap = ratings.filter((rating) => rating > 82).length;
console.log("");
console.log(`Below floor (${RESERVE_MIN_RATING}): ${belowFloor}`);
console.log(`Above cap (82): ${aboveCap}`);

if (mean < 69 || mean > 71) {
  console.error(`Mean ${mean.toFixed(2)} outside target 69–71`);
  failed++;
}
if (belowFloor > 0 || aboveCap > 0) {
  failed++;
}

console.log("");
if (failed > 0) {
  console.error(`Completed with ${failed} warning(s).`);
  process.exit(1);
}
console.log("Distribution within expected tolerances.");
