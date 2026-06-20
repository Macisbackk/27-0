import type { Player } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getRecruitListPositionsForSlot } from "../game/position-placement";

/** Minimum players required for a team-year to appear in Normal Mode spin pools. */
export const MIN_TEAM_YEAR_ROSTER_PLAYERS = 13;

export function isPlayableTeamYearRoster(
  playerIds: readonly string[],
  resolvePlayer: (id: string) => Player | undefined
): boolean {
  if (playerIds.length < MIN_TEAM_YEAR_ROSTER_PLAYERS) return false;

  const players = playerIds
    .map((id) => resolvePlayer(id))
    .filter((player): player is Player => !!player);

  if (players.length < MIN_TEAM_YEAR_ROSTER_PLAYERS) return false;

  for (const { position, count } of SQUAD_STRUCTURE) {
    const allowed = new Set(getRecruitListPositionsForSlot(position));
    const matching = players.filter((player) =>
      allowed.has(player.position)
    ).length;
    if (matching < count) return false;
  }

  return true;
}
