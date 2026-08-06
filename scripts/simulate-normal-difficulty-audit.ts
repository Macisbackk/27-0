/**
 * Audit Normal / Quick Mode season difficulty — sample win rates by squad quality.
 * Run: npm run simulate:normal-difficulty-audit
 * Current Mode: npx tsx scripts/simulate-normal-difficulty-audit.ts --current
 */
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import {
  clearSeasonSquadStrengthCache,
  sampleOpponentSquadRatingsByClub,
} from "../src/lib/game/opponent-squad-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import {
  getChallengeCupClubPool,
  getGlobalRecruitmentPool,
} from "../src/lib/game/player-pool-eligibility";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import type { Player, SquadSlot } from "../src/lib/types";

const SAMPLES_PER_TIER = 40;
const SEED = "difficulty-audit-2026";
const currentSeasonOnly = process.argv.includes("--current");

type Tier = "weak" | "average" | "good" | "elite";

function getAuditPool(): Player[] {
  if (!currentSeasonOnly) return getGlobalRecruitmentPool();
  const byId = new Map<string, Player>();
  for (const club of getPlayableClubNames()) {
    for (const player of getChallengeCupClubPool(club)) {
      byId.set(player.id, player);
    }
  }
  return [...byId.values()];
}

function buildSquadForTargetRating(target: number): SquadSlot[] {
  const pool = getAuditPool();
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
  if (currentSeasonOnly) {
    // Current ratings are compressed (~80–88); targets reflect that band.
    if (tier === "weak") return 80;
    if (tier === "average") return 84;
    if (tier === "good") return 87;
    return 89;
  }
  if (tier === "weak") return 82;
  if (tier === "average") return 86;
  if (tier === "good") return 89;
  return 93;
}

function simulateTier(tier: Tier): {
  wins: number;
  losses: number;
  draws: number;
  avgUserRating: number;
  avgOpponentRating: number;
} {
  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;
  let ratingSum = 0;
  let oppSum = 0;
  let oppCount = 0;

  for (let i = 0; i < SAMPLES_PER_TIER; i++) {
    clearSeasonSquadStrengthCache();
    const squad = buildSquadForTargetRating(tierTarget(tier));
    const seed = `${SEED}-${tier}-${i}`;
    const result = simulateSeason(squad, seed, {
      draftMode: false,
      ...(currentSeasonOnly ? { currentSeasonOnly: true } : {}),
    });
    totalWins += result.wins;
    totalLosses += result.losses;
    totalDraws += result.draws ?? 0;
    ratingSum += getAverageSquadRating(squad);

    const clubs = getPlayableClubNames().slice(0, 6);
    const opp = sampleOpponentSquadRatingsByClub(clubs, seed, {
      ...(currentSeasonOnly ? { currentSeasonOnly: true } : {}),
    });
    for (const v of Object.values(opp)) {
      oppSum += v;
      oppCount++;
    }
  }

  return {
    wins: totalWins,
    losses: totalLosses,
    draws: totalDraws,
    avgUserRating: ratingSum / SAMPLES_PER_TIER,
    avgOpponentRating: oppCount > 0 ? oppSum / oppCount : 0,
  };
}

function main(): void {
  console.log(
    `${currentSeasonOnly ? "Current" : "Normal/Era"} Mode difficulty audit\n`
  );
  const tiers: Tier[] = ["weak", "average", "good", "elite"];

  for (const tier of tiers) {
    const r = simulateTier(tier);
    const games = r.wins + r.losses + r.draws;
    const winPct = games > 0 ? ((r.wins / games) * 100).toFixed(1) : "0";
    console.log(`--- ${tier.toUpperCase()} (target ~${tierTarget(tier)} OVR) ---`);
    console.log(`  Samples: ${SAMPLES_PER_TIER} seasons`);
    console.log(`  Avg user squad rating: ${r.avgUserRating.toFixed(1)}`);
    console.log(`  Avg opponent generated rating: ${r.avgOpponentRating.toFixed(1)}`);
    console.log(
      `  Record: ${r.wins}-${r.draws}-${r.losses} (${winPct}% wins)`
    );
    console.log("");
  }

  console.log(
    "Targets: weak <45% | average ~50-60% | good ~70-85% | elite 90%+ with believable 27-0 rate"
  );
}

main();
