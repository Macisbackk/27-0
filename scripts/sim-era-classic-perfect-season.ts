/**
 * Monte Carlo for Era Classic balance: draft a XIII from the real era spin pools (one random
 * club-season per slot) and play the 27-round season.
 *   random — any eligible player from the spun side; good — one of the two best; best — the best.
 * A strong-but-not-perfect era squad should go 27-0 only rarely.
 * Run: RUNS=300 bun scripts/sim-era-classic-perfect-season.ts
 */
import seedrandom from "seedrandom";
import { clearSeasonSquadStrengthCache } from "../src/lib/game/opponent-squad-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import { getEraModeTeamYearPools } from "../src/lib/game/player-pool-eligibility";
import { getPlayerById } from "../src/lib/players";
import { getPlayerEligiblePositions } from "../src/lib/players/player-positions";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import type { Player } from "../src/lib/types";
const RUNS = Number(process.env.RUNS ?? 300);
const pools = getEraModeTeamYearPools().map(p => p.playerIds.map(id => getPlayerById(id)!).filter(Boolean));
const all = pools.flat();
const hist: Record<number, number> = {};
for (const p of all) hist[p.peakRating] = (hist[p.peakRating] ?? 0) + 1;
console.log("era pool cards", all.length, "mean", (all.reduce((s,p)=>s+p.peakRating,0)/all.length).toFixed(2), "≥90:", (all.filter(p=>p.peakRating>=90).length/all.length*100).toFixed(1)+"%", "≥95:", (all.filter(p=>p.peakRating>=95).length/all.length*100).toFixed(1)+"%");
function draft(rng: () => number, mode: "best" | "good" | "random") {
  let squad = createEmptySquad();
  const used = new Set<string>();
  for (const slot of squad) {
    for (let tries = 0; tries < 30; tries++) {
      const pool = pools[Math.floor(rng() * pools.length)]!;
      const eligible = pool.filter(p => !used.has(p.id) && getPlayerEligiblePositions(p).includes(slot.position));
      if (!eligible.length) continue;
      eligible.sort((a,b)=>b.peakRating-a.peakRating);
      const pick = mode === "best" ? eligible[0]! : mode === "good" ? eligible[Math.min(eligible.length-1, Math.floor(rng()*2))]! : eligible[Math.floor(rng()*eligible.length)]!;
      used.add(pick.id);
      squad = signPlayerToSlot(squad, pick, slot.slotIndex) ?? squad;
      break;
    }
  }
  return squad;
}
for (const mode of ["random","good","best"] as const) {
  const rng = seedrandom(`era-${mode}`);
  let perfect = 0, wins = 0, games = 0, avg = 0, top = 0;
  for (let i = 0; i < RUNS; i++) {
    const squad = draft(rng, mode);
    avg += getAverageSquadRating(squad);
    clearSeasonSquadStrengthCache();
    const r = simulateSeason(squad, `era-${mode}-${i}`, { currentSeasonOnly: false });
    wins += r.wins; games += r.wins + r.losses + (r.draws ?? 0);
    if (r.wins === 27) perfect++;
    if (r.leaguePosition === 1) top++;
  }
  console.log(JSON.stringify({ mode, runs: RUNS, avgSquadRating: +(avg/RUNS).toFixed(2), winPct: +(wins/games*100).toFixed(1), perfectPct: +(perfect/RUNS*100).toFixed(1), firstPct: +(top/RUNS*100).toFixed(1) }));
}
