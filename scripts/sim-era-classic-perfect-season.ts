/**
 * 27-0 formula calibration — Classic (current cards) and Era Classic.
 *
 * Drafts squads through the real slot-spin flow (scripts/lib/sim-draft.ts) per tier:
 *   weak   — lowest offered card every spin
 *   random — any offered card (typical draft)
 *   good   — one of the two best offered (strong draft)
 *   best   — best offered card every spin (near-perfect draft)
 * then plays SEASONS_PER_SQUAD seeded league seasons per squad with the fast record sim
 * (identical draws to simulateSeason) and FULL_SEASONS full simulateSeason runs per tier for
 * league position. Also prints the mean squad ratings that anchor the formula
 * (SIM_FORMULA_MODE_SCALE in src/lib/game/sim-formula.ts) so they can be re-tuned after a
 * ratings change.
 *
 * Run: RUNS=400 SEASONS_PER_SQUAD=10 FULL_SEASONS=40 bun scripts/sim-era-classic-perfect-season.ts
 */
import { draftSquad, type DraftMode, type DraftStrategy } from "./lib/sim-draft";
import {
  perfectSeasonChance,
  simulateSeason,
  simulateSeasonRecord,
} from "../src/lib/game/season-simulation";
import { clearSeasonSquadStrengthCache } from "../src/lib/game/opponent-squad-strength";
import { computeChemistry } from "../src/lib/game/chemistry";
import { getAverageSquadRating } from "../src/lib/squad-analysis";

const RUNS = Number(process.env.RUNS ?? 400);
const SEASONS_PER_SQUAD = Number(process.env.SEASONS_PER_SQUAD ?? 10);
const FULL_SEASONS = Number(process.env.FULL_SEASONS ?? 40);
const MODES = (process.env.MODES ?? "classic,era").split(",") as DraftMode[];
const TIERS: DraftStrategy[] = ["weak", "random", "good", "best"];

for (const mode of MODES) {
  for (const tier of TIERS) {
    let rating = 0;
    let chemistry = 0;
    let analytic = 0;
    let perfect = 0;
    let wins = 0;
    let seasons = 0;
    let position = 0;
    let full = 0;
    for (let i = 0; i < RUNS; i++) {
      const squad = draftSquad(`cal-${mode}-${tier}-${i}`, mode, tier);
      rating += getAverageSquadRating(squad);
      chemistry += computeChemistry(squad).bonus;
      analytic += perfectSeasonChance(squad, mode);
      for (let s = 0; s < SEASONS_PER_SQUAD; s++) {
        const record = simulateSeasonRecord(squad, `season-${mode}-${tier}-${i}-${s}`, { mode });
        const w = record.filter((r) => r === "W").length;
        wins += w;
        seasons++;
        if (w === 27) perfect++;
      }
      if (i < FULL_SEASONS) {
        clearSeasonSquadStrengthCache();
        const result = simulateSeason(squad, `season-${mode}-${tier}-${i}-0`, {
          currentSeasonOnly: mode === "classic",
        });
        position += result.leaguePosition;
        full++;
      }
    }
    console.log(
      JSON.stringify({
        mode,
        tier,
        squads: RUNS,
        seasons,
        avgRating: +(rating / RUNS).toFixed(2),
        avgChemistry: +(chemistry / RUNS).toFixed(2),
        perfectPct: +((perfect / seasons) * 100).toFixed(2),
        formulaPerfectPct: +((analytic / RUNS) * 100).toFixed(2),
        avgWins: +(wins / seasons).toFixed(1),
        avgLeaguePosition: full ? +(position / full).toFixed(1) : null,
      })
    );
  }
}
