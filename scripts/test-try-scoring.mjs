import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Register ts paths via compiled approach - use dynamic import after build
// Instead, inline minimal test of decompose + distribution logic

function scoreHasDropGoal(score) {
  return score % 2 === 1;
}

function decomposeRLScore(score) {
  const dropGoalOptions = scoreHasDropGoal(score) ? [1] : [0];
  let best = null;
  for (const dropGoals of dropGoalOptions) {
    const base = score - dropGoals;
    for (let tries = 0; tries <= 16; tries++) {
      for (let conversions = 0; conversions <= tries; conversions++) {
        const fromTriesAndConv = tries * 4 + conversions * 2;
        if (fromTriesAndConv > base) continue;
        const remainder = base - fromTriesAndConv;
        if (remainder % 2 !== 0) continue;
        const penalties = remainder / 2;
        if (penalties > 8) continue;
        const candidate = { tries, conversions, penalties, dropGoals, points: score };
        const pref = candidate.tries * 12 + candidate.conversions * 2 - candidate.penalties * 5 - candidate.dropGoals;
        const bestPref = best ? best.tries * 12 + best.conversions * 2 - best.penalties * 5 - best.dropGoals : -Infinity;
        if (!best || pref > bestPref) best = candidate;
      }
    }
  }
  return best ?? { tries: Math.floor(score / 4), conversions: 0, penalties: 0, dropGoals: score % 2, points: score };
}

const score24 = decomposeRLScore(24);
const score12 = decomposeRLScore(12);
console.log("24 pts breakdown:", score24);
console.log("12 pts breakdown:", score12);

const verifyPoints = (b) => b.tries * 4 + b.conversions * 2 + b.penalties * 2 + b.dropGoals === b.points;
console.log("24 valid:", verifyPoints(score24));
console.log("12 valid:", verifyPoints(score12));

// Example: Dream Team 24 - 12 Leeds => 4 tries + 2 conv for 24, 2 tries + 2 conv for 12
const dreamTries = score24.tries;
const leedsTries = score12.tries;
console.log(`Dream Team tries: ${dreamTries}, Leeds tries: ${leedsTries}`);
console.log(dreamTries >= 3 && dreamTries <= 6 ? "REALISTIC DREAM TEAM TRIES" : "CHECK TRIES");
