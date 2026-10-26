/**
 * Gauntlet tests: the ten great sides come from the data (Grand Final winners with a season in
 * the pools, rated by their best XIII), are ordered weakest → strongest, every tie uses the 27-0
 * formula's curve, runs are seeded + deterministic and stop at the first defeat, the field is
 * calibrated so a clean sweep is achievable but rare, and the best-run bookkeeping.
 * Run: bun scripts/test-gauntlet.ts   (or: npx tsx scripts/test-gauntlet.ts)
 */
import { GRAND_FINALS } from "../data/quiz/facts";
import {
  GAUNTLET_FIELD_OFFSET,
  GAUNTLET_LENGTH,
  GAUNTLET_MAX_PER_CLUB,
  gauntletScoreForChances,
  getGauntletCandidates,
  getGauntletChances,
  getGauntletOpponents,
  getGauntletTeamStrength,
  getTeamYearBestXiii,
  runGauntlet,
} from "../src/lib/game/gauntlet";
import { getSpinTeamYearPoolsCached } from "../src/lib/game/player-pool-eligibility";
import { getTeamStrength, winProbability } from "../src/lib/game/sim-formula";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import { applyGauntletRun, emptyModeRecords } from "../src/lib/storage/mode-records";
import { draftSquad } from "./lib/sim-draft";

let passed = 0;
let failed = 0;
function check(condition: unknown, message: string): void {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------
const opponents = getGauntletOpponents();
check(opponents.length === GAUNTLET_LENGTH, `ten sides (got ${opponents.length})`);
const champions = new Set(GRAND_FINALS.map((f) => `${f.winnerName}|${f.year}`));
const pools = getSpinTeamYearPoolsCached("all");
for (const side of opponents) {
  check(champions.has(`${side.club}|${side.year}`), `${side.label} won the Grand Final that year`);
  check(pools.some((p) => p.team === side.club && p.year === String(side.year)), `${side.label} is a real team-year pool`);
  const xiii = getTeamYearBestXiii(side.club, String(side.year));
  check(Math.abs(getAverageSquadRating(xiii) - side.squadRating) < 1e-9, `${side.label}: rating is its best XIII (${side.squadRating})`);
  const expected = getTeamStrength({ avgRating: side.squadRating, mode: side.ladder }) - GAUNTLET_FIELD_OFFSET;
  check(Math.abs(side.strength - expected) < 1e-9, `${side.label}: strength from its actual rating`);
  check(side.ladder === (side.year === 2026 ? "classic" : "era"), `${side.label}: read on the right ladder`);
}
for (let i = 1; i < opponents.length; i++) {
  check(opponents[i]!.strength >= opponents[i - 1]!.strength, `ordered by strength: ${opponents[i - 1]!.label} ≤ ${opponents[i]!.label}`);
}
const perClub = new Map<string, number>();
for (const side of opponents) perClub.set(side.club, (perClub.get(side.club) ?? 0) + 1);
check([...perClub.values()].every((n) => n <= GAUNTLET_MAX_PER_CLUB), "no more than three seasons from one club");
check(new Set(opponents.map((o) => o.label)).size === GAUNTLET_LENGTH, "ten different sides");
// The ten are the strongest eligible champions (under the per-club cap).
const candidates = getGauntletCandidates();
const weakestIn = Math.min(...opponents.map((o) => o.strength));
const left = candidates.filter((c) => !opponents.some((o) => o.label === c.label));
for (const c of left) {
  const clubFull = (perClub.get(c.club) ?? 0) >= GAUNTLET_MAX_PER_CLUB;
  check(clubFull || c.strength <= weakestIn, `${c.label} left out only for being weaker or its club being full`);
}
check(getGauntletOpponents() === opponents, "the field is memoised (same for everyone)");
console.log(`field: ${opponents.map((o) => `${o.label} ${o.squadRating}`).join(" → ")}`);

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
for (const mode of ["classic", "era"] as const) {
  const squad = draftSquad(`gauntlet-test-${mode}`, mode, "good");
  const strength = getGauntletTeamStrength(squad, mode);
  const scores = new Set<number>();
  for (let s = 0; s < 40; s++) {
    const seed = `g-test-${mode}-${s}`;
    const a = runGauntlet(squad, seed, mode);
    const b = runGauntlet(squad, seed, mode);
    check(JSON.stringify(a) === JSON.stringify(b), `${mode} ${seed}: deterministic`);
    check(a.beaten === a.ties.filter((t) => t.won).length, `${mode} ${seed}: score = sides beaten`);
    check(
      a.perfect ? a.ties.length === GAUNTLET_LENGTH : a.ties.length === a.beaten + 1 && !a.ties.at(-1)!.won,
      `${mode} ${seed}: one defeat ends the run`
    );
    for (const tie of a.ties) {
      check(tie.opponent === opponents[tie.index], `${mode} ${seed}: tie ${tie.index} is side ${tie.index}`);
      check(
        Math.abs(tie.winProbability - winProbability(strength - tie.opponent.strength)) < 1e-12,
        `${mode} ${seed}: tie ${tie.index} uses winProbability(gap)`
      );
      check(tie.won ? tie.pointsFor > tie.pointsAgainst : tie.pointsFor < tie.pointsAgainst, `${mode} ${seed}: scoreline matches result`);
    }
    check(gauntletScoreForChances(getGauntletChances(squad, mode), seed) === a.beaten, `${mode} ${seed}: fast score matches`);
    scores.add(a.beaten);
  }
  check(scores.size > 1, `${mode}: different seeds give different runs`);
}

// ---------------------------------------------------------------------------
// Calibration sanity (scripts/sim-one-club-gauntlet.ts has the full numbers)
// ---------------------------------------------------------------------------
for (const mode of ["classic", "era"] as const) {
  const sweep = (tier: "best" | "random" | "weak") => {
    let total = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      total += getGauntletChances(draftSquad(`g-cal-${mode}-${tier}-${i}`, mode, tier), mode).reduce((p, x) => p * x, 1);
    }
    return total / N;
  };
  const best = sweep("best");
  const typical = sweep("random");
  const weak = sweep("weak");
  check(best > 0.1 && best < 0.6, `${mode}: near-perfect draft sweeps ${(best * 100).toFixed(1)}% (achievable)`);
  check(typical < 0.08, `${mode}: typical draft sweeps ${(typical * 100).toFixed(2)}% (rare)`);
  check(weak < 0.001, `${mode}: weakest-card draft basically never sweeps`);
}

// ---------------------------------------------------------------------------
// Bests
// ---------------------------------------------------------------------------
let state = emptyModeRecords();
let res = applyGauntletRun(state, { runId: "a", beaten: 3, era: false, total: 10 });
state = res.state;
check(res.newBest && state.gauntlet.best === 3 && state.gauntlet.bestCurrent === 3 && state.gauntlet.bestEra === 0, "first run sets the best");
res = applyGauntletRun(state, { runId: "a", beaten: 9, era: false, total: 10 });
check(res.state === state, "same run never counts twice");
res = applyGauntletRun(state, { runId: "b", beaten: 10, era: true, total: 10 });
state = res.state;
check(res.newBest && state.gauntlet.sweeps === 1 && state.gauntlet.bestEra === 10 && state.gauntlet.runs === 2, "sweep counted");
res = applyGauntletRun(state, { runId: "c", beaten: 2, era: true, total: 10 });
check(!res.newBest && res.state.gauntlet.best === 10, "worse run keeps the best");

console.log(`\nGauntlet: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
