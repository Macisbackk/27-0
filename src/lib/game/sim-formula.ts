/**
 * The 27-0 formula — one win-probability curve for Classic (current cards) and Era Classic.
 *
 * See the comment block at the top of season-simulation.ts for the plain-English version.
 *
 *   draft quality   q = (squad avg rating − TYPICAL[mode]) / (ELITE[mode] − TYPICAL[mode])
 *                       0 = a typical draft for that mode, 1 = taking the best card on every spin
 *   team strength   S = 80 + 8·q + (chemistry − TYPICAL_CHEMISTRY[mode]) + halfway-call delta
 *   strength gap    g = S − opponent club rating ± 1 (home / away)
 *   win chance      p = 1 / (1 + e^(−g / 3)),  kept within [1%, 99.5%]
 *   27-0 chance     = product of p over the 27 fixtures
 *
 * Era cards are rated a few points higher than current cards, so raw ratings are never compared
 * across modes: each mode's squad rating is placed on its own draft ladder (q) first, and the
 * same q gives the same odds in both modes. The anchors are the mean ratings of simulated drafts
 * through the real spin flow (scripts/sim-era-classic-perfect-season.ts recomputes them).
 *
 * Pure: no RNG, no React. The season sim draws one seeded number per match and wins if it is
 * below p, so the same seed + squad + halfway call always gives the same season.
 */
import { getClubBaseStrength } from "./club-strength";

export type SimFormulaMode = "classic" | "era";

export interface SimFormulaModeScale {
  /** Mean squad rating of a typical draft (a random one of the three offered cards per spin). */
  typicalRating: number;
  /** Mean squad rating of a near-perfect draft (the best offered card on every spin). */
  eliteRating: number;
  /** Mean chemistry bonus of a typical draft (Era cards can link on shared card years). */
  typicalChemistry: number;
}

export const SIM_FORMULA_MODE_SCALE: Record<SimFormulaMode, SimFormulaModeScale> = {
  classic: { typicalRating: 83.1, eliteRating: 85.5, typicalChemistry: 0 },
  era: { typicalRating: 86.6, eliteRating: 88.5, typicalChemistry: 0.6 },
};

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
    ((input.chemistry ?? 0) - scale.typicalChemistry) +
    (input.ratingDelta ?? 0)
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
