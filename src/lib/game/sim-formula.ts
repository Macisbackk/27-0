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
 */
export const SIM_FORMULA_MODE_SCALE: Record<SimFormulaMode, SimFormulaModeScale> = {
  classic: { typicalRating: 83.1, eliteRating: 86.0, typicalChemistry: 1, opponentEdge: 2, chemistryWeight: 0.8 },
  // v1.48: Daily / Gauntlet on 2026 cards get tougher opponents like Classic (owner: same feel);
  // +1.6 lands their best drafts on Classic's odds (no 3-club choice to lift the rating).
  "classic-spin": { typicalRating: 83.1, eliteRating: 85.5, typicalChemistry: 0, opponentEdge: 1.6, chemistryWeight: 0.8 },
  era: { typicalRating: 85.6, eliteRating: 87.5, typicalChemistry: 0, opponentEdge: 0.4, noChemistry: true },
};

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
