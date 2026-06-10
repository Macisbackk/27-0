import type { Player, Position } from "../types";

/** Theoretical season maximum — soft logic only, never hard-blocked. */
export const SEASON_TRY_THEORETICAL_MAX = 34;

/**
 * Position try probability tiers (played position).
 * Highest: wings & fullbacks · High: centres · Medium: halves
 * Low: second row & loose forward · Very low: props & hookers
 */
export const POSITION_TRY_WEIGHT: Record<Position, number> = {
  WING: 12.5,
  FULLBACK: 11.5,
  CENTRE: 11,
  STAND_OFF: 8,
  SCRUM_HALF: 7.5,
  SECOND_ROW: 4.8,
  LOOSE_FORWARD: 3.6,
  HOOKER: 2.4,
  PROP: 0.65,
};

/** Soft season caps by played position (share of team tries). */
export const POSITION_SEASON_SHARE_MAX: Record<Position, number> = {
  WING: 0.22,
  FULLBACK: 0.17,
  CENTRE: 0.16,
  STAND_OFF: 0.13,
  SCRUM_HALF: 0.12,
  SECOND_ROW: 0.11,
  LOOSE_FORWARD: 0.09,
  HOOKER: 0.07,
  PROP: 0.05,
};

/**
 * Soft try guides — diminishing returns intensify beyond these, but 34 remains
 * theoretically reachable for any position.
 */
export const POSITION_SOFT_TRY_GUIDE: Record<Position, number> = {
  WING: 26,
  FULLBACK: 16,
  CENTRE: 16,
  STAND_OFF: 12,
  SCRUM_HALF: 12,
  SECOND_ROW: 12,
  LOOSE_FORWARD: 10,
  HOOKER: 10,
  PROP: 6,
};

/** @deprecated Use POSITION_SOFT_TRY_GUIDE — kept for imports; all positions cap at 34. */
export const POSITION_SEASON_TRY_MAX: Record<Position, number> = {
  WING: SEASON_TRY_THEORETICAL_MAX,
  FULLBACK: SEASON_TRY_THEORETICAL_MAX,
  CENTRE: SEASON_TRY_THEORETICAL_MAX,
  STAND_OFF: SEASON_TRY_THEORETICAL_MAX,
  SCRUM_HALF: SEASON_TRY_THEORETICAL_MAX,
  SECOND_ROW: SEASON_TRY_THEORETICAL_MAX,
  LOOSE_FORWARD: SEASON_TRY_THEORETICAL_MAX,
  HOOKER: SEASON_TRY_THEORETICAL_MAX,
  PROP: SEASON_TRY_THEORETICAL_MAX,
};

export function hasKnownCareerTries(player: Player): boolean {
  return player.tries !== undefined;
}

/**
 * Mild career try hint — must not dominate position weighting.
 * Unknown tries → 1 (position + rating only).
 */
export function getCareerTryMultiplier(player: Player): number {
  if (!hasKnownCareerTries(player)) return 1;
  const tries = player.tries!;
  return Math.min(1.28, 1 + Math.log10(tries + 1) * 0.22);
}

/**
 * Rating modifier within position tier.
 * A 95-rated prop must not outscore an 86-rated winger.
 */
export function getRatingTryModifier(
  rating: number,
  position: Position
): number {
  const tier = POSITION_TRY_WEIGHT[position];
  const isForward = tier < 6;
  const ratingSlope = isForward ? 0.019 : 0.011;
  const boost = 1 + (rating - 80) * ratingSlope;
  const maxLift = isForward
    ? tier >= 4
      ? 1.34
      : tier >= 2
        ? 1.28
        : 1.16
    : tier >= 10
      ? 1.24
      : 1.22;
  const minLift = isForward
    ? tier >= 4
      ? 0.76
      : tier >= 2
        ? 0.72
        : 0.68
    : tier >= 10
      ? 0.82
      : 0.78;
  return Math.min(maxLift, Math.max(minLift, boost));
}

/** Combined position + rating + mild career weight for match allocation. */
export function getPlayerTryWeight(
  player: Player,
  playedPosition?: Position,
  rating?: number
): number {
  const position = playedPosition ?? player.position;
  const positionWeight = POSITION_TRY_WEIGHT[position];
  const effectiveRating = rating ?? player.peakRating;
  return (
    positionWeight *
    getRatingTryModifier(effectiveRating, position) *
    getCareerTryMultiplier(player)
  );
}
