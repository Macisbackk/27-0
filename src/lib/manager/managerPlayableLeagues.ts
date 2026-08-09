/**
 * New-career league → club select helpers.
 * League definitions live in `managerLeagues.ts` (canonical registry).
 */
export {
  getManagerLeague,
  getManagerPlayableLeague,
  getLeagueDisplayName,
  getLeagueShortName,
  getLeagueSeasonGames,
  leagueHasPlayoffs,
  getLeagueEconomyScale,
  MANAGER_LEAGUES,
  MANAGER_LEAGUE_IDS,
  MANAGER_PLAYABLE_LEAGUES,
  type ManagerLeagueDefinition,
  type ManagerPlayableLeagueDefinition,
} from "./managerLeagues";

import type { ManagerCompetitionId } from "./types";
import { getAllManagerClubConfigs, type ManagerClubConfig } from "./club-config";
import {
  MANAGER_LEAGUE_IDS,
  MANAGER_LEAGUES,
  type ManagerLeagueDefinition,
} from "./managerLeagues";

/** Clubs for a league on the club-select step. */
export function getClubsForPlayableLeague(
  leagueId: ManagerCompetitionId
): ManagerClubConfig[] {
  return getAllManagerClubConfigs().filter(
    (c) => (c.competition ?? "super-league") === leagueId
  );
}

/** Leagues available on the new-career league select screen. */
export function listSelectableManagerLeagues(): ManagerLeagueDefinition[] {
  return MANAGER_LEAGUE_IDS.map((id) => MANAGER_LEAGUES[id])
    .filter((league) => {
      if (!league.selectable) return false;
      return getClubsForPlayableLeague(league.id).length > 0;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
