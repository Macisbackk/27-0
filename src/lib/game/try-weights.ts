import type { Player, Position } from "../types";

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
  SECOND_ROW: 2.5,
  LOOSE_FORWARD: 2.2,
  HOOKER: 1.2,
  PROP: 0.35,
};

/** Soft season caps by played position (share of team tries). */
export const POSITION_SEASON_SHARE_MAX: Record<Position, number> = {
  WING: 0.22,
  FULLBACK: 0.17,
  CENTRE: 0.16,
  STAND_OFF: 0.13,
  SCRUM_HALF: 0.12,
  SECOND_ROW: 0.08,
  LOOSE_FORWARD: 0.07,
  HOOKER: 0.05,
  PROP: 0.04,
};

/** Absolute season try ceilings by played position. */
export const POSITION_SEASON_TRY_MAX: Record<Position, number> = {
  WING: 28,
  FULLBACK: 18,
  CENTRE: 18,
  STAND_OFF: 14,
  SCRUM_HALF: 14,
  SECOND_ROW: 8,
  LOOSE_FORWARD: 8,
  HOOKER: 6,
  PROP: 4,
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
  const boost = 1 + (rating - 80) * 0.011;
  const maxLift =
    tier >= 10 ? 1.24 : tier >= 6 ? 1.22 : tier >= 2 ? 1.14 : 1.08;
  const minLift = tier >= 10 ? 0.82 : tier >= 6 ? 0.78 : 0.72;
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
