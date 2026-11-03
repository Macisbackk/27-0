/**
 * The 27-0 formula — one win-probability curve for Classic (current cards) and Era Classic.
 *
 * See the comment block at the top of season-simulation.ts for the plain-English version.
 *
 *   draft quality   q = (squad avg rating − TYPICAL[ladder]) / (ELITE[ladder] − TYPICAL[ladder])
 *                       0 = a typical draft on that ladder, 1 = taking the top card on every spin
 *   team strength   S = 80 + 8·q + (chemistry − TYPICAL_CHEMISTRY[ladder]) + halfway-call delta
 *                       (chemistry counts in Classic only — it has no effect in Era, v1.40)
 *   strength gap    g = S − opponent club rating ± 1 (home / away)
 *   win chance      p = 1 / (1 + e^(−g / 3)),  kept within [1%, 99.5%]
 *   27-0 chance     = product of p over the 27 fixtures
 *
 * Each draft flow has its own ladder, because the same squad rating means a different thing
 * depending on the cards you were offered:
 *   classic       — normal Classic (2026 squads): the reel spins a position, pick one of three
 *                   cards for it from three different clubs, one usually a club link (v1.40)
 *   classic-spin  — 2026 squads through the club spin (one club, three of its cards): Daily /
 *                   Weekly on Classic and the Classic Gauntlet keep this flow and these odds
 *   era           — historic club-seasons through the club spin
 * Era cards are rated a few points higher than current cards, so raw ratings are never compared
 * across ladders: a squad is placed on its own ladder (q) first, and the same q gives the same
 * odds everywhere (bar Era's small opponent edge). The anchors come from simulated drafts
 * through the real spin flows (scripts/sim-era-classic-perfect-season.ts recomputes them).
 *
 * Pure: no RNG, no React. The season sim draws one seeded number per match and wins if it is
 * below p, so the same seed + squad + halfway call always gives the same season.
 */
import { getClubBaseStrength } from "./club-strength";

export type SimFormulaMode = "classic" | "classic-spin" | "era";

export interface SimFormulaModeScale {
  /** Mean squad rating of a typical draft (a random one of the three offered cards per spin). */
  typicalRating: number;
  /**
   * Squad rating of a near-perfect draft (the top offered card on every spin). Where chemistry
   * counts and a near-perfect draft links more than a typical one, the anchor folds that extra
   * chemistry in, so a near-perfect draft (rating + chemistry) still lands on q ≈ 1.
   */
  eliteRating: number;
  /** Mean chemistry bonus of a typical draft (0 where chemistry doesn't count). */
  typicalChemistry: number;
  /** Extra strength every opponent has in this mode (Era: a touch harder, owner v1.36). */
  opponentEdge?: number;
  /** How much each point of chemistry above typical counts (default 1). */
  chemistryWeight?: number;
  /** Squad chemistry has no effect in this mode (Era, owner v1.40). */
  noChemistry?: boolean;
}

/**
 * Classic (position spin + club choice, 400 drafts per tier, v1.40): typical draft 83.1 rating
 * / +1.0 chemistry, top card every spin 85.86 / +1.86. Elite 86.0 puts the top-card draft just
 * past q = 1 with its extra +0.85 chemistry counted: 8·(85.86 − 83.1)/(86.0 − 83.1) + 0.85 ≈ 8.5
 * (≈ 30% 27-0, the middle of the 25–35% target).
 * v1.42: Classic opponents get +0.7 (owner: "Classic now too easy"; players stack club links
 * beyond what the top-card bot does). Top-card 27-0 ≈ 29% → ≈ 23%, good ≈ 2.3% → 1.4%.
 * v1.43 (owner: "still way too easy"): opponents +2 and chemistry counts half, so stacking
 * club links can't carry a squad. Top-card draft 27-0 ≈ 28% → ≈ 13%.
 * Classic spin and Era: mean ratings of the typical and top-card drafts (unchanged in v1.40;
 * Era's typical chemistry was 0.3 before chemistry stopped counting there).
 *
 * Nov 2026: current cards moved from 80–99 to 70–99 (data/current-ratings-2026-11.md), which
 * widens drafted squads (club choice: typical 83.10 → 82.05, top card 85.86 → 86.74; chemistry
 * 1.01 → 1.09 typical, 1.86 → 1.57 top card). Classic and Classic-spin anchors were refitted so
 * each tier keeps its 27-0 odds (400 drafts/tier, formula): Classic best 14.8% → 14.9%, good
 * 0.80% → 1.07%, typical 0.11% → 0.09%; Classic spin best 14.2% → 14.1%, good 1.15% → 1.35%,
 * typical 0.15% → 0.11%. (On test-sim-formula's 100-squad sample: Classic best 18.1% → 16.6%,
 * spin 16.2% → 15.7%.) Era is untouched.
 *
 * v1.70 (owner: perfect runs should feel rarer, targets Classic ≈11%, Era ≈16% for a near-perfect
 * draft): only the elite anchors move — Classic 86.62 → 86.97, Era 87.5 → 88.05 — so a top squad
 * sits a little lower on its ladder while a typical draft (q = 0) is untouched. 400-draft sweep
 * (scripts/health-odds-sweep.ts, ODDS_LEVER=elite): Classic best 15.2% → ~11%, good 0.85% →
 * ~0.55%, typical wins 15.3 unchanged; Era best 29% → ~16%, good 7.8% → ~3.8%, typical 18.2
 * wins unchanged. Classic spin (Daily / Weekly / Gauntlet) is unchanged.
 */
export const SIM_FORMULA_MODE_SCALE: Record<SimFormulaMode, SimFormulaModeScale> = {
  classic: { typicalRating: 82.18, eliteRating: 86.97, typicalChemistry: 1.09, opponentEdge: 2, chemistryWeight: 0.8 },
  // v1.48: Daily / Gauntlet on 2026 cards get tougher opponents like Classic (owner: same feel);
  // +1.6 lands their best drafts on Classic's odds (no 3-club choice to lift the rating).
  "classic-spin": { typicalRating: 81.82, eliteRating: 86.14, typicalChemistry: 0, opponentEdge: 1.6, chemistryWeight: 0.8 },
  era: { typicalRating: 85.6, eliteRating: 88.05, typicalChemistry: 0, opponentEdge: 0.4, noChemistry: true },
};

/**
 * Nov 2026: current cards moved from 80–99 to 70–99 (data/current-ratings-2026-11.md). The
 * play-off / cup path (resolveOutcome) still compares a raw squad rating with fixed club
 * strengths, so a Classic squad's average is read back on the old scale there: a typical draft
 * (club choice, random card) and a top-card draft land where they did before, and the order and
 * gaps between squads in between are kept. Anchors are the mean squad ratings of those drafts
 * before and after the rescale (scripts/sim-era-classic-perfect-season.ts, 400 drafts per tier).
 */
export const CURRENT_LEGACY_RATING_MAP = {
  typical: { now: 82.05, before: 83.1 },
  elite: { now: 86.74, before: 85.86 },
} as const;

/** A Classic (current-card) squad average on the pre-Nov-2026 80–99 scale. */
export function toLegacyCurrentRating(avgRating: number): number {
  const { typical, elite } = CURRENT_LEGACY_RATING_MAP;
  return typical.before + ((avgRating - typical.now) * (elite.before - typical.before)) / (elite.now - typical.now);
}

/** Whether squad chemistry counts towards team strength in this mode (Classic yes, Era no). */
export function modeUsesChemistry(mode: SimFormulaMode): boolean {
  return !SIM_FORMULA_MODE_SCALE[mode].noChemistry;
}

/** League-scale strength of a typical draft (opponent club ratings run 66–84). */
export const TEAM_STRENGTH_TYPICAL = 80;
/** League-scale strength added going from a typical to a near-perfect draft. */
export const TEAM_STRENGTH_SPREAD = 8;
/** Strength-gap points for playing at home (and against you away). */
export const HOME_ADVANTAGE = 1;
/** Width of the logistic curve: a gap of +3 is a ~73% win, +6 ~88%, +9 ~95%. */
export const WIN_CURVE_WIDTH = 3;
export const MIN_WIN_PROBABILITY = 0.01;
export const MAX_WIN_PROBABILITY = 0.995;

/** Default ladder for a league season: normal Classic (club choice) or Era. */
export function getSimFormulaMode(currentSeasonOnly: boolean): SimFormulaMode {
  return currentSeasonOnly ? "classic" : "era";
}

/** Where a squad rating sits on its mode's draft ladder (0 typical, 1 near-perfect). */
export function getDraftQuality(avgRating: number, mode: SimFormulaMode): number {
  const scale = SIM_FORMULA_MODE_SCALE[mode];
  return (avgRating - scale.typicalRating) / (scale.eliteRating - scale.typicalRating);
}

export interface TeamStrengthInput {
  /** Average effective squad rating (getAverageSquadRating). */
  avgRating: number;
  mode: SimFormulaMode;
  /** Squad chemistry bonus (0 … 3). */
  chemistry?: number;
  /** Halfway-call rating change for the round (getHalfwayRatingDelta). */
  ratingDelta?: number;
}

/** Mode-normalised team strength on the league scale (typical draft ≈ 80). */
export function getTeamStrength(input: TeamStrengthInput): number {
  const scale = SIM_FORMULA_MODE_SCALE[input.mode];
  return (
    TEAM_STRENGTH_TYPICAL +
    TEAM_STRENGTH_SPREAD * getDraftQuality(input.avgRating, input.mode) +
    ((input.chemistry ?? 0) - scale.typicalChemistry) * (scale.chemistryWeight ?? 1) +
    (input.ratingDelta ?? 0) -
    (scale.opponentEdge ?? 0)
  );
}

/** Opponent rating = the club's tier (Wigan 84 … Wakefield 66); Daily clones use their club's. */
export function getOpponentRating(club: string): number {
  return getClubBaseStrength(club);
}

export function getStrengthGap(
  teamStrength: number,
  opponentRating: number,
  isHome: boolean
): number {
  return teamStrength - opponentRating + (isHome ? HOME_ADVANTAGE : -HOME_ADVANTAGE);
}

/** The single curve: chance of winning a league game from the strength gap. */
export function winProbability(gap: number): number {
  const p = 1 / (1 + Math.exp(-gap / WIN_CURVE_WIDTH));
  return Math.min(MAX_WIN_PROBABILITY, Math.max(MIN_WIN_PROBABILITY, p));
}

/** 27-0 chance for a list of fixture win probabilities. */
export function perfectChanceFromProbabilities(probabilities: readonly number[]): number {
  return probabilities.reduce((product, p) => product * p, 1);
}
