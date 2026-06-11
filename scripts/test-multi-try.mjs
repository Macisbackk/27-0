import seedrandom from "seedrandom";
import { allocateMatchTries } from "../src/lib/game/try-allocation.ts";

const positions = ["WING", "CENTRE", "FULLBACK", "STAND_OFF", "PROP", "HOOKER"];
const weights = [12, 11, 10, 7, 0.8, 2];
const ratings = [92, 88, 85, 82, 78, 80];

let multi2 = 0;
let multi3 = 0;
let multi4 = 0;
let multi5 = 0;
const runs = 5000;

for (let i = 0; i < runs; i++) {
  const rng = seedrandom(`mt-${i}`);
  const matchTries = 4 + Math.floor(rng() * 5);
  const alloc = allocateMatchTries(matchTries, weights, rng, {
    positions,
    ratings,
    seasonTotalsSoFar: [8, 6, 5, 4, 2, 1],
  });
  const max = Math.max(...alloc);
  const sum = alloc.reduce((a, b) => a + b, 0);
  if (sum !== matchTries) {
    console.error("FAIL sum", sum, matchTries);
    process.exit(1);
  }
  if (max >= 2) multi2++;
  if (max >= 3) multi3++;
  if (max >= 4) multi4++;
  if (max >= 5) multi5++;
}

console.log(`Multi-try simulation (${runs} matches, 4-8 team tries):`);
console.log(`  2+ tries in a match: ${((multi2 / runs) * 100).toFixed(1)}%`);
console.log(`  3+ tries: ${((multi3 / runs) * 100).toFixed(1)}%`);
console.log(`  4+ tries: ${((multi4 / runs) * 100).toFixed(1)}%`);
console.log(`  5 tries: ${((multi5 / runs) * 100).toFixed(1)}%`);
console.log(multi2 > 0 && multi5 / runs < 0.02 ? "PASS" : "CHECK");
