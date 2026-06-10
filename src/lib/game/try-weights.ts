import type { Player, Position } from "../types";

/**
 * Position try probability tiers.
 * Highest: wings & fullbacks · High: centres · Medium: halves
 * Lower: second row & loose forward · Lowest: props & hookers
 */
export const POSITION_TRY_WEIGHT: Record<Position, number> = {
  WING: 12,
  FULLBACK: 11,
  CENTRE: 9,
  STAND_OFF: 6,
  SCRUM_HALF: 5.5,
  SECOND_ROW: 2.2,
  LOOSE_FORWARD: 2,
  HOOKER: 0.65,
  PROP: 0.45,
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
  // Softer curve so one prolific winger does not dominate every match.
  return 1 + Math.log10(tries + 1) * 0.55;
}

/** Combined position + career try weight for match allocation. */
export function getPlayerTryWeight(player: Player): number {
  const positionWeight = POSITION_TRY_WEIGHT[player.position];
  return positionWeight * getCareerTryMultiplier(player);
}
