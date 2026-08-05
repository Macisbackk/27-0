/**
 * Monte Carlo: opening generated-reserve rating distribution.
 * Run: npx tsx scripts/sim-reserve-generation.ts
 */
import {
  GENERATED_RESERVE_MAX_RATING,
  RESERVE_GENERATOR_VERSION,
  generateReservePlayer,
  RESERVE_POSITION_COVERAGE,
} from "../src/lib/manager/managerReserves";
import type { Position } from "../src/lib/types";

const CAREERS = 1000;
const PER_CAREER = 24;

const ratings: number[] = [];
for (let c = 0; c < CAREERS; c++) {
  const seed = `sim-res-${c}`;
  const positions: Position[] = [];
  for (const { position, min } of RESERVE_POSITION_COVERAGE) {
    for (let i = 0; i < min; i++) positions.push(position);
  }
  while (positions.length < PER_CAREER) {
    positions.push(RESERVE_POSITION_COVERAGE[positions.length % RESERVE_POSITION_COVERAGE.length]!.position);
  }
  for (let i = 0; i < PER_CAREER; i++) {
    const p = generateReservePlayer(seed, i, positions[i]!, "Leeds Rhinos", 0, 2026);
    ratings.push(p.rating);
    if (p.ratingGeneration?.generatorVersion !== RESERVE_GENERATOR_VERSION) {
      throw new Error("missing generator stamp");
    }
  }
}

ratings.sort((a, b) => a - b);
const n = ratings.length;
const sum = ratings.reduce((a, b) => a + b, 0);
const mean = sum / n;
const median = (ratings[Math.floor((n - 1) / 2)]! + ratings[Math.ceil((n - 1) / 2)]!) / 2;

function band(lo: number, hi: number) {
  const count = ratings.filter((r) => r >= lo && r <= hi).length;
  return ((count / n) * 100).toFixed(1);
}

console.log(`Reserve generator v${RESERVE_GENERATOR_VERSION} — ${n} players (${CAREERS} careers × ${PER_CAREER})`);
console.log(`Mean: ${mean.toFixed(2)}  Median: ${median.toFixed(2)}  Max cap: ${GENERATED_RESERVE_MAX_RATING}`);
console.log(`65–67: ${band(65, 67)}%`);
console.log(`68–70: ${band(68, 70)}%`);
console.log(`71–73: ${band(71, 73)}%`);
console.log(`74–76: ${band(74, 76)}%`);
console.log(`77–79: ${band(77, 79)}%`);
console.log(`80+:   ${band(80, 99)}%`);
console.log(`>=77:  ${((ratings.filter((r) => r >= 77).length / n) * 100).toFixed(1)}%`);
console.log(`>=80:  ${((ratings.filter((r) => r >= 80).length / n) * 100).toFixed(1)}%`);
