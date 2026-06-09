import type { Player, Position } from "../types";

/**
 * Position try probability tiers.
 * Highest: wings & fullbacks · High: centres · Medium: halves
 * Lower: second row & loose forward · Lowest: props & hookers
 */
export const POSITION_TRY_WEIGHT: Record<Position, number> = {
  WING: 10,
  FULLBACK: 10,
  CENTRE: 7,
  STAND_OFF: 4,
  SCRUM_HALF: 3.5,
  SECOND_ROW: 2,
  LOOSE_FORWARD: 1.8,
  HOOKER: 0.8,
  PROP: 0.6,
};

export function hasKnownCareerTries(player: Player): boolean {
  return player.tries !== undefined;
}

/**
 * Career try multiplier — 200-career-try players score far more often than 15-try players.
 * Unknown tries → 1 (position weighting only).
 */
export function getCareerTryMultiplier(player: Player): number {
  if (!hasKnownCareerTries(player)) return 1;
  const tries = player.tries!;
  return 1 + Math.log10(tries + 1) * 0.9;
}

/** Combined position + career try weight for match allocation. */
export function getPlayerTryWeight(player: Player): number {
  const positionWeight = POSITION_TRY_WEIGHT[player.position];
  return positionWeight * getCareerTryMultiplier(player);
}
