/**
 * 27-0 odds sweep: how each ladder's 27-0 chance (formula) and average wins move if every
 * opponent in that mode gets a little stronger (SIM_FORMULA_MODE_SCALE[mode].opponentEdge).
 * Report only. Run: bun scripts/health-odds-sweep.ts [squads=400]
 */
import { appendFileSync } from "node:fs";
import { draftSquad, type DraftFlow, type DraftMode, type DraftStrategy } from "./lib/sim-draft";
import { SIM_FORMULA_MODE_SCALE, type SimFormulaMode } from "../src/lib/game/sim-formula";
import { getSeasonFixtureChances, perfectSeasonChance } from "../src/lib/game/season-simulation";

const N = Number(process.argv[2] ?? 400);
const LADDERS: { mode: SimFormulaMode; cards: DraftMode; flow: DraftFlow; label: string }[] = [
  { mode: "classic", cards: "classic", flow: "club-choice", label: "Classic" },
  { mode: "classic-spin", cards: "classic", flow: "club-spin", label: "Classic spin (Daily/Weekly/Gauntlet)" },
  { mode: "era", cards: "era", flow: "club-spin", label: "Era Classic" },
];
const TIERS: DraftStrategy[] = ["best", "good", "random"];
const STEPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
const pct = (x: number) => `${(x * 100).toFixed(x >= 0.1 ? 1 : 2)}%`;
const out: string[] = ["# 27-0 odds sweep", `${N} drafts per tier; chance = formula (product of the 27 win chances), wins = expected league wins.`, ""];
for (const L of LADDERS) {
  const squads: Record<string, ReturnType<typeof draftSquad>[]> = {};
  for (const t of TIERS) squads[t] = Array.from({ length: N }, (_, i) => draftSquad(`odds-${L.cards}-${L.flow}-${t}-${i}`, L.cards, t, { flow: L.flow }));
  const base = SIM_FORMULA_MODE_SCALE[L.mode].opponentEdge ?? 0;
  out.push(`## ${L.label} (current opponent edge ${base})`, "", `| Extra edge | Best 27-0 | Best wins | Good 27-0 | Good wins | Random 27-0 | Random wins |`, `|---|---|---|---|---|---|---|`);
  for (const extra of STEPS) {
    SIM_FORMULA_MODE_SCALE[L.mode].opponentEdge = base + extra;
    const cells: string[] = [];
    for (const t of TIERS) {
      let chance = 0;
      let wins = 0;
      squads[t]!.forEach((sq, i) => {
        chance += perfectSeasonChance(sq, L.mode);
        wins += getSeasonFixtureChances(sq, `odds-season-${i}`, { mode: L.mode }).reduce((a, f) => a + f.winProbability, 0);
      });
      cells.push(pct(chance / N), (wins / N).toFixed(1));
    }
    out.push(`| +${extra} | ${cells.join(" | ")} |`);
  }
  SIM_FORMULA_MODE_SCALE[L.mode].opponentEdge = base;
  out.push("");
}
const md = out.join("\n") + "\n";
process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
