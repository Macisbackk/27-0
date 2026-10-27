/**
 * 27-0 formula tests (Classic + Era Classic league seasons).
 *
 * - winProbability is one increasing logistic curve, never 0 or 1
 * - team strength rises with squad rating, chemistry and the halfway delta
 * - the same draft quality gives the same strength / 27-0 chance in both modes
 * - drafted tiers land in their 27-0 bands (fixed seeds, so deterministic)
 * - seasons are deterministic, the fast record matches simulateSeason, and the halfway call
 *   never changes rounds 1–14; Super Sam Hallas Mode still goes 27-0
 *
 * Run: npm run test:sim   (or: bun scripts/test-sim-formula.ts)
 */
import { draftSquad, type DraftMode, type DraftStrategy } from "./lib/sim-draft";
import {
  getDraftQuality,
  getTeamStrength,
  MAX_WIN_PROBABILITY,
  MIN_WIN_PROBABILITY,
  SIM_FORMULA_MODE_SCALE,
  winProbability,
} from "../src/lib/game/sim-formula";
import {
  getSeasonFixtureChances,
  perfectSeasonChance,
  perfectSeasonChanceForStrength,
  SEASON_GAMES,
  simulateSeason,
  simulateSeasonRecord,
} from "../src/lib/game/season-simulation";
import { HALFWAY_CALL_ROUND } from "../src/lib/game/halfway-call";
import { computeChemistry } from "../src/lib/game/chemistry";
import { getAverageSquadRating } from "../src/lib/squad-analysis";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

// --- The curve -------------------------------------------------------------------------------
{
  let increasing = true;
  let prev = 0;
  for (let gap = -30; gap <= 30; gap += 0.5) {
    const p = winProbability(gap);
    if (p < prev) increasing = false;
    prev = p;
  }
  assert(increasing, "winProbability never falls as the gap grows");
  assert(Math.abs(winProbability(0) - 0.5) < 1e-9, "an even gap is a 50% game");
  assert(
    Math.abs(winProbability(4) + winProbability(-4) - 1) < 1e-9,
    "the curve is symmetric (+g and −g add to 1)"
  );
  assert(
    winProbability(-100) === MIN_WIN_PROBABILITY && winProbability(100) === MAX_WIN_PROBABILITY,
    "the curve is clamped: never a sure loss, never a sure win"
  );
  assert(
    perfectSeasonChanceForStrength(200) < 1 && perfectSeasonChanceForStrength(200) > 0.8,
    `even an absurdly strong side is not guaranteed 27-0 (${pct(perfectSeasonChanceForStrength(200))})`
  );
}

// --- Strength and symmetry across modes ------------------------------------------------------
{
  let monotone = true;
  let prevChance = -1;
  for (let rating = 78; rating <= 92; rating += 0.25) {
    const chance = perfectSeasonChanceForStrength(getTeamStrength({ avgRating: rating, mode: "era" }));
    if (chance < prevChance) monotone = false;
    prevChance = chance;
  }
  assert(monotone, "27-0 chance never falls as the squad rating rises");
  const base = getTeamStrength({ avgRating: 85, mode: "classic" });
  assert(
    getTeamStrength({ avgRating: 85, mode: "classic", chemistry: 1.5 }) > base &&
      getTeamStrength({ avgRating: 85, mode: "classic", ratingDelta: 1 }) > base &&
      getTeamStrength({ avgRating: 85, mode: "classic", ratingDelta: -1.5 }) < base,
    "chemistry and the halfway delta move strength the right way"
  );

  let symmetric = true;
  for (const q of [-1.5, -0.5, 0, 0.4, 1, 1.5]) {
    const at = (mode: DraftMode) => {
      const s = SIM_FORMULA_MODE_SCALE[mode];
      return s.typicalRating + q * (s.eliteRating - s.typicalRating);
    };
    const classic = getTeamStrength({ avgRating: at("classic"), mode: "classic" });
    // Era opponents carry a small extra edge (v1.36); add it back to compare the ladders.
    const eraEdge = SIM_FORMULA_MODE_SCALE.era.opponentEdge ?? 0;
    const era = eraEdge + getTeamStrength({
      avgRating: at("era"),
      mode: "era",
      chemistry: SIM_FORMULA_MODE_SCALE.era.typicalChemistry,
    });
    if (
      Math.abs(classic - era) > 1e-9 ||
      Math.abs(getDraftQuality(at("classic"), "classic") - q) > 1e-9 ||
      Math.abs(perfectSeasonChanceForStrength(classic) - perfectSeasonChanceForStrength(era)) > 1e-12
    ) {
      symmetric = false;
    }
  }
  assert(symmetric, "same draft quality ⇒ same strength and same 27-0 chance in Classic and Era (before Era's opponent edge)");
  const edge = SIM_FORMULA_MODE_SCALE.era.opponentEdge ?? 0;
  assert(edge > 0 && edge <= 1, "Era opponents are only slightly tougher (edge 0–1)");
  assert(
    SIM_FORMULA_MODE_SCALE.era.typicalRating > SIM_FORMULA_MODE_SCALE.classic.typicalRating,
    "Era is anchored higher than Classic (Era cards are rated higher)"
  );
}

// --- Drafted tiers land in their bands ------------------------------------------------------
const SQUADS = Number(process.env.SQUADS ?? 100);
const SEASONS = Number(process.env.SEASONS ?? 10);
const BANDS: Record<DraftStrategy, [number, number]> = {
  // Targets: best ≈ 25–35%, good ≈ 4–8%, typical ≈ 0.5–1.5% (Era's spin luck pushes ~3%), weak ≈ 0.
  // Bands are wider than the targets: tier averages are driven by a few lucky spins, so a
  // fixed 100-squad sample still swings by a couple of points.
  best: [0.15, 0.45],
  good: [0.015, 0.12],
  random: [0.001, 0.06],
  weak: [0, 0.005],
};
const tierChance: Record<string, number> = {};
const tierMedian: Record<string, number> = {};
for (const mode of ["classic", "era"] as DraftMode[]) {
  for (const tier of ["weak", "random", "good", "best"] as DraftStrategy[]) {
    let formula = 0;
    let perfect = 0;
    let wins = 0;
    let minChance = 1;
    const chances: number[] = [];
    for (let i = 0; i < SQUADS; i++) {
      const squad = draftSquad(`test-sim-${mode}-${tier}-${i}`, mode, tier);
      const chance = perfectSeasonChance(squad, mode);
      chances.push(chance);
      formula += chance;
      minChance = Math.min(minChance, chance);
      for (let s = 0; s < SEASONS; s++) {
        const record = simulateSeasonRecord(squad, `test-sim-season-${mode}-${tier}-${i}-${s}`, { mode });
        const w = record.filter((r) => r === "W").length;
        wins += w;
        if (w === SEASON_GAMES) perfect++;
      }
    }
    const avg = formula / SQUADS;
    const simulated = perfect / (SQUADS * SEASONS);
    tierChance[`${mode}-${tier}`] = avg;
    tierMedian[`${mode}-${tier}`] = chances.sort((x, y) => x - y)[Math.floor(SQUADS / 2)]!;
    const [lo, hi] = BANDS[tier];
    assert(
      avg >= lo && avg <= hi,
      `${mode} ${tier} draft: formula 27-0 ${pct(avg)}, simulated ${pct(simulated)} over ${SQUADS * SEASONS} seasons, ${(wins / (SQUADS * SEASONS)).toFixed(1)} wins avg (band ${pct(lo)}–${pct(hi)})`
    );
    assert(
      Math.abs(simulated - avg) < Math.max(0.05, avg * 0.35),
      `${mode} ${tier}: simulated rate tracks the formula`
    );
    if (tier === "best") {
      assert(minChance > 0, `${mode} best drafts never have a 0% chance (lowest ${minChance.toExponential(1)})`);
    }
  }
  // Medians: the typical squad of each tier (tier means are swung by a few lucky spins).
  const m = (t: string) => tierMedian[`${mode}-${t}`]!;
  assert(
    m("weak") < m("random") && m("random") < m("good") && m("good") < m("best"),
    `${mode}: better drafting ⇒ better 27-0 odds for the median squad (${["weak", "random", "good", "best"].map((t) => pct(m(t))).join(" < ")})`
  );
}
assert(
  Math.abs(tierChance["classic-best"]! - tierChance["era-best"]!) < 0.12,
  `near-perfect drafts get similar odds in both modes (Classic ${pct(tierChance["classic-best"]!)} vs Era ${pct(tierChance["era-best"]!)})`
);

// --- Determinism ----------------------------------------------------------------------------
{
  const squad = draftSquad("test-sim-determinism", "era", "good");
  const seed = "test-sim-determinism-season";
  const a = simulateSeason(squad, seed);
  const b = simulateSeason(squad, seed);
  assert(JSON.stringify(a.fixtures) === JSON.stringify(b.fixtures), "same seed + squad ⇒ same season");

  let recordsMatch = true;
  for (let i = 0; i < 6; i++) {
    for (const mode of ["classic", "era"] as DraftMode[]) {
      const s = `test-sim-record-${mode}-${i}`;
      const full = simulateSeason(squad, s, { currentSeasonOnly: mode === "classic" });
      const fast = simulateSeasonRecord(squad, s, { mode });
      if (full.gameResults.join("") !== fast.join("")) recordsMatch = false;
    }
  }
  assert(recordsMatch, "the fast record sim makes exactly simulateSeason's draws");

  const chances = getSeasonFixtureChances(squad, seed, { mode: "era" });
  const seeded = perfectSeasonChance(squad, "era", { seed });
  const product = chances.reduce((x, f) => x * f.winProbability, 1);
  assert(Math.abs(seeded - product) < 1e-12, "seeded 27-0 chance is the product of the fixture chances");

  const none = simulateSeason(squad, seed, { halfwayCall: "none" });
  const push = simulateSeason(squad, seed, { halfwayCall: "push" });
  const rest = simulateSeason(squad, seed, { halfwayCall: "rest" });
  const same = (x: typeof none, y: typeof none) =>
    JSON.stringify(x.fixtures.slice(0, HALFWAY_CALL_ROUND)) ===
    JSON.stringify(y.fixtures.slice(0, HALFWAY_CALL_ROUND));
  assert(same(none, push) && same(none, rest), "halfway call never changes rounds 1–14");

  const daily = simulateSeason(squad, seed, { forceOpponentClub: "Wigan Warriors" });
  const dailyAgain = simulateSeason(squad, seed, { forceOpponentClub: "Wigan Warriors" });
  assert(
    daily.gameResults.join("") === dailyAgain.gameResults.join(""),
    "Daily seasons (forced club) are deterministic for everyone on the seed"
  );
  assert(
    perfectSeasonChance(squad, "era", { forceOpponentClub: "Wigan Warriors" }) <
      perfectSeasonChance(squad, "era", { forceOpponentClub: "Wakefield Trinity" }),
    "a league of Wigan clones is harder than a league of Wakefield clones"
  );

  const sam = simulateSeason(squad, seed, { forceUndefeated: true });
  assert(sam.wins === SEASON_GAMES && sam.isPerfect, "Super Sam Hallas Mode still goes 27-0");
  assert(computeChemistry(squad).bonus >= 0 && getAverageSquadRating(squad) > 0, "drafted squad is valid");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
