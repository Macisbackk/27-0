/**
 * Monte Carlo: elite Quick Mode squads should be able to go 27-0.
 * Run: npx tsx scripts/sim-quick-mode-perfect-season.ts
 */
import { clearSeasonSquadStrengthCache } from "../src/lib/game/opponent-squad-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import { getGlobalRecruitmentPool } from "../src/lib/game/player-pool-eligibility";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import type { Player, SquadSlot } from "../src/lib/types";

const SEASONS = Number(process.env.SIM_RUNS ?? 200);

function buildSquadFromPool(pool: Player[], target: number): SquadSlot[] {
  const ranked = [...pool].sort(
    (a, b) =>
      Math.abs(a.peakRating - target) - Math.abs(b.peakRating - target) ||
      b.peakRating - a.peakRating
  );
  let squad = createEmptySquad();
  const picked = new Set<string>();
  for (const slot of squad) {
    const player = ranked.find((p) => !picked.has(p.id));
    if (!player) break;
    picked.add(player.id);
    squad = signPlayerToSlot(squad, player, slot.slotIndex) ?? squad;
  }
  return squad;
}

function runTier(
  label: string,
  target: number,
  draftMode: boolean,
  pool: Player[]
) {
  const squad = buildSquadFromPool(pool, target);
  const avgRating = getAverageSquadRating(squad);
  let perfect = 0;
  let wins = 0;
  let losses = 0;

  for (let i = 0; i < SEASONS; i++) {
    clearSeasonSquadStrengthCache();
    const result = simulateSeason(squad, `perfect-${label}-${i}`, {
      draftMode,
    });
    wins += result.wins;
    losses += result.losses;
    if (result.wins === 27) perfect++;
  }

  const games = wins + losses;
  console.log(
    JSON.stringify({
      label,
      draftMode,
      target,
      seasons: SEASONS,
      avgRating: Number(avgRating.toFixed(2)),
      winPct: Number(((wins / games) * 100).toFixed(1)),
      perfectSeasons: perfect,
      perfectPct: Number(((perfect / SEASONS) * 100).toFixed(1)),
    })
  );
}

function main() {
  console.log("Loading pool...");
  const pool = getGlobalRecruitmentPool();
  console.log(`Pool size: ${pool.length}`);
  runTier("normal-average", 86, false, pool);
  runTier("normal-good", 89, false, pool);
  runTier("normal-elite", 93, false, pool);
  runTier("draft-elite", 93, true, pool);
}

main();
