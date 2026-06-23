/**
 * Audit Normal Mode season difficulty — sample win rates by squad quality.
 * Run: npm run simulate:normal-difficulty-audit
 */
import seedrandom from "seedrandom";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { clearSeasonSquadStrengthCache, sampleOpponentSquadRatingsByClub } from "../src/lib/game/opponent-squad-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import { getGlobalRecruitmentPool } from "../src/lib/game/player-pool-eligibility";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import type { SquadSlot } from "../src/lib/types";

const SAMPLES_PER_TIER = 40;
const SEED = "difficulty-audit-2026";

type Tier = "weak" | "average" | "good" | "elite";

function buildSquadForTargetRating(target: number): SquadSlot[] {
  const pool = getGlobalRecruitmentPool();
  if (pool.length < 13) throw new Error("Insufficient player pool");

  const ranked = [...pool].sort(
    (a, b) =>
      Math.abs(a.peakRating - target) - Math.abs(b.peakRating - target) ||
      a.peakRating - b.peakRating
  );

  let squad = createEmptySquad();
  const slots = squad.map((s) => s.slotIndex);
  const picked = new Set<string>();

  for (const slotIndex of slots) {
    const player = ranked.find((p) => !picked.has(p.id));
    if (!player) break;
    picked.add(player.id);
    squad = signPlayerToSlot(squad, player, slotIndex) ?? squad;
  }

  return squad;
}

function tierTarget(tier: Tier): number {
  if (tier === "weak") return 74;
  if (tier === "average") return 79;
  if (tier === "good") return 84;
  return 89;
}

function simulateTier(tier: Tier): {
  wins: number;
  losses: number;
  avgUserRating: number;
  avgOpponentRating: number;
} {
  let totalWins = 0;
  let totalLosses = 0;
  let ratingSum = 0;
  let oppSum = 0;
  let oppCount = 0;

  for (let i = 0; i < SAMPLES_PER_TIER; i++) {
    clearSeasonSquadStrengthCache();
    const squad = buildSquadForTargetRating(tierTarget(tier));
    const seed = `${SEED}-${tier}-${i}`;
    const result = simulateSeason(squad, seed, { draftMode: false });
    totalWins += result.wins;
    totalLosses += result.losses;
    ratingSum += getAverageSquadRating(squad);

    const clubs = getPlayableClubNames().slice(0, 6);
    const opp = sampleOpponentSquadRatingsByClub(clubs, seed);
    for (const v of Object.values(opp)) {
      oppSum += v;
      oppCount++;
    }
  }

  return {
    wins: totalWins,
    losses: totalLosses,
    avgUserRating: ratingSum / SAMPLES_PER_TIER,
    avgOpponentRating: oppCount > 0 ? oppSum / oppCount : 0,
  };
}

function main(): void {
  console.log("Normal Mode difficulty audit\n");
  const tiers: Tier[] = ["weak", "average", "good", "elite"];

  for (const tier of tiers) {
    const r = simulateTier(tier);
    const games = r.wins + r.losses;
    const winPct = games > 0 ? ((r.wins / games) * 100).toFixed(1) : "0";
    console.log(`--- ${tier.toUpperCase()} (target ~${tierTarget(tier)} OVR) ---`);
    console.log(`  Samples: ${SAMPLES_PER_TIER} seasons`);
    console.log(`  Avg user squad rating: ${r.avgUserRating.toFixed(1)}`);
    console.log(`  Avg opponent generated rating: ${r.avgOpponentRating.toFixed(1)}`);
    console.log(`  Record: ${r.wins}-${r.losses} (${winPct}% wins)`);
    console.log("");
  }

  console.log("Targets: weak <40% | average ~45-55% | good ~60-75% | elite 75%+");
}

main();
