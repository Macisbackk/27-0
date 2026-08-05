/**
 * Monte Carlo check for the senior-approach season budget.
 * Run: npx tsx scripts/sim-transfer-balance.ts
 */
import seedrandom from "seedrandom";
import {
  getSeniorApproachSeasonTarget,
  getSeniorApproachWeeklyChance,
} from "../src/lib/manager/managerTransferLeague";
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "../src/lib/manager/transferActivityConfig";
import type { ManagerCareer } from "../src/lib/manager/types";

const SEASONS = 1_000;
const SEASON_WEEKS = 27;
const counts = new Map<number, number>();
let totalOffers = 0;
let earlyOffers = 0;

for (let season = 0; season < SEASONS; season++) {
  const seed = `transfer-balance-${season}`;
  const career = {
    seed,
    seasonYear: 2026 + season,
  } as ManagerCareer;
  const target = getSeniorApproachSeasonTarget(career);
  let offers = 0;

  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const chance = getSeniorApproachWeeklyChance(week, offers, target);
    const rng = seedrandom(`${seed}-unsolicited-w${week}`);
    if (rng() <= chance) {
      offers++;
      if (
        week <=
        DEFAULT_TRANSFER_ACTIVITY_CONFIG.transferTargetPool
          .earlySeasonThroughWeek
      ) {
        earlyOffers++;
      }
    }
  }

  counts.set(offers, (counts.get(offers) ?? 0) + 1);
  totalOffers += offers;
}

console.log(`Transfer target balance: ${SEASONS} simulated seasons`);
for (let offers = 0; offers <= 6; offers++) {
  const seasons = counts.get(offers) ?? 0;
  if (seasons > 0) {
    console.log(
      `  ${offers} senior approaches: ${seasons} seasons (${(
        (seasons / SEASONS) *
        100
      ).toFixed(1)}%)`
    );
  }
}
console.log(`  average senior approaches: ${(totalOffers / SEASONS).toFixed(2)}`);
console.log(
  `  opening-week share: ${((earlyOffers / Math.max(1, totalOffers)) * 100).toFixed(1)}%`
);

const outsideRange = [...counts.entries()]
  .filter(([offers]) => offers < 2 || offers > 5)
  .reduce((sum, [, seasons]) => sum + seasons, 0);
if (outsideRange > 0) {
  throw new Error(`${outsideRange} seasons fell outside the 2-5 approach cap`);
}
