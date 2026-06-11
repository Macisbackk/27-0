/**
 * Quick Monte Carlo estimate of Draft Mode 27-0 odds after rebalance.
 * Run: npx tsx scripts/simulate-draft-balance.ts
 */
import seedrandom from "seedrandom";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import {
  generateDraftOfferForPick,
  getRoundPlayers,
  type RecruitmentOptions,
} from "../src/lib/game/recruitment";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import type { SquadSlot } from "../src/lib/types";

function autofillDraft(seed: string, options: RecruitmentOptions): SquadSlot[] {
  let squad = createEmptySquad();
  const signed: string[] = [];

  for (let pick = 0; pick < 13; pick++) {
    const offer = generateDraftOfferForPick(
      seed,
      pick,
      squad,
      signed,
      [],
      [],
      options
    );
    if (!offer) continue;

    const [a, b] = getRoundPlayers(offer);
    const rng = seedrandom(`${seed}-sim-pick-${pick}`);
    const chosen = rng() < 0.5 ? a : b;

    const empty = squad.filter((s) => !s.player);
    const bestSlot = [...empty].sort((x, y) => {
      const score = (slot: typeof x) => {
        if (slot.position === chosen.position) return 0;
        if (
          (slot.position === "STAND_OFF" || slot.position === "SCRUM_HALF") &&
          (chosen.position === "STAND_OFF" || chosen.position === "SCRUM_HALF")
        ) {
          return 0.5;
        }
        return 1;
      };
      return score(x) - score(y);
    })[0];

    if (!bestSlot) break;
    const penalty =
      bestSlot.position === chosen.position ||
      ((bestSlot.position === "STAND_OFF" || bestSlot.position === "SCRUM_HALF") &&
        (chosen.position === "STAND_OFF" || chosen.position === "SCRUM_HALF"))
        ? 0
        : 5;
    squad = signPlayerToSlot(squad, chosen, bestSlot.slotIndex, penalty);
    signed.push(chosen.id);
  }

  return squad;
}

function runTrials(
  label: string,
  trials: number,
  options: RecruitmentOptions
): void {
  let perfect = 0;
  let wins25Plus = 0;
  let wins22Plus = 0;
  let totalWins = 0;
  let totalAvg = 0;
  const buckets = {
    lt85: { n: 0, perfect: 0, wins: 0 },
    b85_87: { n: 0, perfect: 0, wins: 0 },
    b88_89: { n: 0, perfect: 0, wins: 0 },
    b90_91: { n: 0, perfect: 0, wins: 0 },
    gte92: { n: 0, perfect: 0, wins: 0 },
  };

  for (let i = 0; i < trials; i++) {
    const seed = `draft-balance-${label}-${i}`;
    const squad = autofillDraft(seed, options);
    const avg = getAverageSquadRating(squad);
    totalAvg += avg;
    const result = simulateSeason(squad, seed, { draftMode: true });
    totalWins += result.wins;
    if (result.isPerfect) perfect++;
    if (result.wins >= 25) wins25Plus++;
    if (result.wins >= 22) wins22Plus++;

    const bucket =
      avg >= 92
        ? buckets.gte92
        : avg >= 90
          ? buckets.b90_91
          : avg >= 88
            ? buckets.b88_89
            : avg >= 85
              ? buckets.b85_87
              : buckets.lt85;
    bucket.n++;
    bucket.wins += result.wins;
    if (result.isPerfect) bucket.perfect++;
  }

  console.log(`\n${label} (${trials} trials)`);
  console.log(`  Avg squad rating: ${(totalAvg / trials).toFixed(1)}`);
  console.log(`  Avg wins: ${(totalWins / trials).toFixed(1)}`);
  console.log(`  27-0 rate: ${((perfect / trials) * 100).toFixed(1)}%`);
  console.log(`  25+ wins: ${((wins25Plus / trials) * 100).toFixed(1)}%`);
  console.log(`  22+ wins: ${((wins22Plus / trials) * 100).toFixed(1)}%`);

  for (const [name, bucket] of Object.entries(buckets)) {
    if (bucket.n === 0) continue;
    console.log(
      `  ${name}: n=${bucket.n}, avg wins=${(bucket.wins / bucket.n).toFixed(1)}, 27-0=${((bucket.perfect / bucket.n) * 100).toFixed(1)}%`
    );
  }
}

const TRIALS = 400;
runTrials("Standard Draft", TRIALS, {
  draftMode: true,
  hardMode: false,
});
runTrials("Hard Draft", TRIALS, {
  draftMode: true,
  hardMode: true,
});
