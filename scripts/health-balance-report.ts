/**
 * Game balance report (v1.66 health check). Not a pass/fail test: it prints how fair and how
 * varied seasons are for each ladder and draft quality, so tuning has numbers behind it.
 *
 * - wins per season: mean, spread (p10–p90) and the 27-0 rate
 * - variety: how many different win totals show up, and how often the same squad's seasons differ
 * - chemistry: how much it moves a Classic squad's 27-0 chance (Era ignores it by design)
 * - opponents: each club's beat rate, so no club is a free win or a brick wall
 *
 * Run: bun scripts/health-balance-report.ts [squads=150] [seasons=6]
 * Writes Markdown to stdout (and to $GITHUB_STEP_SUMMARY in CI).
 */
import { appendFileSync } from "node:fs";
import { draftSquad, type DraftFlow, type DraftMode, type DraftStrategy } from "./lib/sim-draft";
import { type SimFormulaMode } from "../src/lib/game/sim-formula";
import { getSeasonFixtureChances, perfectSeasonChance, SEASON_GAMES, simulateSeasonRecord } from "../src/lib/game/season-simulation";
import { computeChemistry } from "../src/lib/game/chemistry";

const SQUADS = Number(process.argv[2] ?? 150);
const SEASONS = Number(process.argv[3] ?? 6);
const LADDERS: { mode: SimFormulaMode; cards: DraftMode; flow: DraftFlow; label: string }[] = [
  { mode: "classic", cards: "classic", flow: "club-choice", label: "Classic" },
  { mode: "classic-spin", cards: "classic", flow: "club-spin", label: "Classic (club spin)" },
  { mode: "era", cards: "era", flow: "club-spin", label: "Era" },
];
const TIERS: DraftStrategy[] = ["weak", "random", "good", "best"];

const out: string[] = [];
const say = (s = "") => out.push(s);
const pct = (x: number) => (x >= 0.1 ? `${(x * 100).toFixed(0)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : `${(x * 100).toFixed(2)}%`);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;

say(`# Game balance report`);
say(`${SQUADS} drafted squads per row, ${SEASONS} seasons each (${SEASON_GAMES} games a season).`);
say();
say(`| Ladder | Draft | Avg wins | p10–p90 wins | Win totals seen | 27-0 (sim) | 27-0 (formula) | Same squad, different seasons |`);
say(`|---|---|---|---|---|---|---|---|`);

const opp: Record<string, { games: number; wins: number }> = {};
const chemRows: string[] = [];
for (const L of LADDERS) {
  for (const tier of TIERS) {
    const wins: number[] = [];
    let perfect = 0;
    let formula = 0;
    let varied = 0;
    for (let i = 0; i < SQUADS; i++) {
      const squad = draftSquad(`health-${L.cards}-${L.flow}-${tier}-${i}`, L.cards, tier, { flow: L.flow });
      formula += perfectSeasonChance(squad, L.mode);
      const mine = new Set<number>();
      for (let s = 0; s < SEASONS; s++) {
        const seed = `health-season-${L.mode}-${tier}-${i}-${s}`;
        const rec = simulateSeasonRecord(squad, seed, { mode: L.mode });
        const w = rec.filter((r) => r === "W").length;
        wins.push(w);
        mine.add(w);
        if (w === SEASON_GAMES) perfect++;
        if (L.mode === "classic" && tier === "random") {
          const fx = getSeasonFixtureChances(squad, seed, { mode: L.mode });
          fx.forEach((f, k) => {
            const o = (opp[f.opponent] ??= { games: 0, wins: 0 });
            o.games++;
            if (rec[k] === "W") o.wins++;
          });
        }
      }
      if (mine.size > 1) varied++;
      if (L.mode === "classic" && tier === "good" && i < 60) {
        const on = perfectSeasonChance(squad, L.mode);
        const off = perfectSeasonChance(squad, L.mode, { applyChemistry: false });
        chemRows.push(`${computeChemistry(squad).bonus}|${on}|${off}`);
      }
    }
    const n = SQUADS * SEASONS;
    const mean = wins.reduce((a, b) => a + b, 0) / n;
    say(
      `| ${L.label} | ${tier} | ${mean.toFixed(1)} | ${q(wins, 0.1)}–${q(wins, 0.9)} | ${new Set(wins).size} | ${pct(perfect / n)} | ${pct(formula / SQUADS)} | ${pct(varied / SQUADS)} |`
    );
  }
}

say();
say(`## Chemistry (Classic, good drafts)`);
{
  const rows = chemRows.map((r) => r.split("|").map(Number)) as [number, number, number][];
  const lift = rows.map(([, on, off]) => on - off);
  const avgOn = rows.reduce((a, r) => a + r[1], 0) / rows.length;
  const avgOff = rows.reduce((a, r) => a + r[2], 0) / rows.length;
  const avgBonus = rows.reduce((a, r) => a + r[0], 0) / rows.length;
  say(`Average chemistry bonus +${avgBonus.toFixed(1)} rating. 27-0 chance with chemistry ${pct(avgOn)} vs without ${pct(avgOff)} (median lift ${pct(q(lift, 0.5))}, best lift ${pct(Math.max(...lift))}).`);
}

say();
say(`## Opponents (Classic, random drafts): share of games the user wins`);
const oppRows = Object.entries(opp)
  .filter(([, o]) => o.games >= 30)
  .map(([club, o]) => ({ club, rate: o.wins / o.games, games: o.games }))
  .sort((a, b) => a.rate - b.rate);
say(`| Opponent | Beaten | Games |`);
say(`|---|---|---|`);
for (const r of oppRows) say(`| ${r.club} | ${pct(r.rate)} | ${r.games} |`);
if (oppRows.length) {
  const spread = oppRows[oppRows.length - 1]!.rate - oppRows[0]!.rate;
  say();
  say(`Hardest ${oppRows[0]!.club} (${pct(oppRows[0]!.rate)}), easiest ${oppRows[oppRows.length - 1]!.club} (${pct(oppRows[oppRows.length - 1]!.rate)}), spread ${pct(spread)}.`);
}

const md = out.join("\n") + "\n";
process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
