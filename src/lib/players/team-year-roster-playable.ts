import type { Player, Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getRecruitListPositionsForSlot } from "../game/position-placement";
import { getTeamYearWikipediaPosition } from "./era-wikipedia-squads";
import {
  getPlayerEligiblePositions,
  playerEligibleForSlot,
} from "./player-positions";

/** Minimum players required for a team-year to appear in Normal Mode spin pools. */
export const MIN_TEAM_YEAR_ROSTER_PLAYERS = 13;

/** Position used for recruitment filtering — Wikipedia slot when verified, else natural. */
export function getTeamYearRecruitPosition(
  team: string,
  year: string,
  player: Player
): Position {
  return getTeamYearWikipediaPosition(team, year, player.id) ?? player.position;
}

export function getTeamYearRecruitPositions(
  team: string,
  year: string,
  player: Player
): Position[] {
  const wiki = getTeamYearWikipediaPosition(team, year, player.id);
  if (wiki) return [wiki];
  return getPlayerEligiblePositions(player);
}

export function canPlayerFillTeamYearSlot(
  team: string,
  year: string,
  player: Player,
  slotPosition: Position
): boolean {
  const allowed = getRecruitListPositionsForSlot(slotPosition);
  return getTeamYearRecruitPositions(team, year, player).some((pos) =>
    allowed.includes(pos)
  );
}

export function isPlayableTeamYearRoster(
  team: string,
  year: string,
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
      getTeamYearRecruitPositions(team, year, player).some((pos) =>
        allowed.has(pos)
      )
    ).length;
    if (matching < count) return false;
  }

  return true;
}
