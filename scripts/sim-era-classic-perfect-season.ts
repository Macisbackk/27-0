/**
 * 27-0 formula calibration — Classic (current cards) and Era Classic.
 *
 * Drafts squads through the real slot-spin flows (scripts/lib/sim-draft.ts) per tier —
 * Classic's club choice (three cards from three clubs, scored by rating + chemistry), Classic
 * cards through the club spin ("classic-spin": Daily / Weekly / Gauntlet) and Era's club spin:
 *   weak   — lowest offered card every spin
 *   random — any offered card (typical draft)
 *   good   — one of the two best offered (strong draft)
 *   best   — best offered card every spin (near-perfect draft)
 * Classic's elite anchor folds in the extra chemistry a near-perfect draft builds (see
 * SIM_FORMULA_MODE_SCALE); the others are the plain mean ratings.
 * then plays SEASONS_PER_SQUAD seeded league seasons per squad with the fast record sim
 * (identical draws to simulateSeason) and FULL_SEASONS full simulateSeason runs per tier for
 * league position. Also prints the mean squad ratings that anchor the formula
 * (SIM_FORMULA_MODE_SCALE in src/lib/game/sim-formula.ts) so they can be re-tuned after a
 * ratings change.
 *
 * Run: RUNS=400 SEASONS_PER_SQUAD=10 FULL_SEASONS=40 bun scripts/sim-era-classic-perfect-season.ts
 */
import { draftSquad, type DraftFlow, type DraftMode, type DraftStrategy } from "./lib/sim-draft";
import {
  perfectSeasonChance,
  simulateSeason,
  simulateSeasonRecord,
} from "../src/lib/game/season-simulation";
import { clearSeasonSquadStrengthCache } from "../src/lib/game/opponent-squad-strength";
import { computeChemistry } from "../src/lib/game/chemistry";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import { SIM_FORMULA_MODE_SCALE, type SimFormulaMode } from "../src/lib/game/sim-formula";

const RUNS = Number(process.env.RUNS ?? 400);
const SEASONS_PER_SQUAD = Number(process.env.SEASONS_PER_SQUAD ?? 10);
const FULL_SEASONS = Number(process.env.FULL_SEASONS ?? 40);
const MODES = (process.env.MODES ?? "classic,classic-spin,era").split(",") as SimFormulaMode[];
const TIERS: DraftStrategy[] = ["weak", "random", "good", "best"];
const LADDER: Record<SimFormulaMode, { cards: DraftMode; flow: DraftFlow }> = {
  classic: { cards: "classic", flow: "club-choice" },
  "classic-spin": { cards: "classic", flow: "club-spin" },
  era: { cards: "era", flow: "club-spin" },
};

for (const mode of MODES) {
  const { cards, flow } = LADDER[mode];
  const means: Partial<Record<DraftStrategy, { rating: number; chemistry: number }>> = {};
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
      const squad = draftSquad(`cal-${cards}-${tier}-${i}`, cards, tier, { flow });
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
          currentSeasonOnly: cards === "classic",
          formulaMode: mode,
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
    means[tier] = { rating: rating / RUNS, chemistry: chemistry / RUNS };
  }
  // Suggested anchors: typical = the random tier; elite = the rating that puts the best tier on
  // q = 1 once its chemistry above a typical draft's is counted (plain mean where it's ~0).
  const typical = means.random!;
  const best = means.best!;
  const extraChem = SIM_FORMULA_MODE_SCALE[mode].noChemistry ? 0 : best.chemistry - typical.chemistry;
  const elite = typical.rating + (8 * (best.rating - typical.rating)) / (8 - extraChem);
  console.log(
    JSON.stringify({
      mode,
      suggestedAnchors: {
        typicalRating: +typical.rating.toFixed(2),
        eliteRating: +elite.toFixed(2),
        typicalChemistry: SIM_FORMULA_MODE_SCALE[mode].noChemistry ? 0 : +typical.chemistry.toFixed(2),
      },
      current: SIM_FORMULA_MODE_SCALE[mode],
    })
  );
}
