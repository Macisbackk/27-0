import { isSuperLeagueSeason } from "./super-league-club-years";
import teamYearRostersData from "../../../data/team-year-rosters.json";
import {
  getCurrentPlayableClubNames,
  getEraPlayableClubNames,
  isCurrentPlayableClub,
  isEraPlayableClub,
} from "../clubs/super-league-display";
import {
  isPlayableTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
} from "./team-year-roster-playable";
import {
  getTeamYearRosterMeta,
  isTeamYearPlayableInEra,
  isTeamYearPlayableInNormalSpin,
} from "./team-year-roster-meta";
import { CURRENT_SEASON_YEAR } from "../play-links";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

const TEAM_YEAR_ROSTERS = teamYearRostersData as TeamYearRosters;

export { MIN_TEAM_YEAR_ROSTER_PLAYERS };

export function getCurrentCalendarYear(): number {
  return new Date().getFullYear();
}

export function getTeamYearRosters(): TeamYearRosters {
  return TEAM_YEAR_ROSTERS;
}

/** All clubs with any roster data in team-year-rosters.json. */
export function getAllTeamsInYearRosters(): string[] {
  return Object.keys(TEAM_YEAR_ROSTERS).sort((a, b) => a.localeCompare(b));
}

/** Current Super League clubs with roster data (Current Mode browse). */
export function getTeamsWithYearRosters(): string[] {
  return getAllTeamsInYearRosters().filter((team) => isCurrentPlayableClub(team));
}

/** Era-eligible clubs with roster data (Era Mode browse). */
export function getEraTeamsWithYearRosters(): string[] {
  return getAllTeamsInYearRosters().filter((team) => isEraPlayableClub(team));
}

function rosterIds(team: string, year: string): string[] {
  return TEAM_YEAR_ROSTERS[team]?.[year] ?? [];
}

function passesYearGate(team: string, year: string): boolean {
  const currentYear = getCurrentCalendarYear();
  if (Number(year) > currentYear) return false;
  return isSuperLeagueSeason(team, year);
}

export function getYearsForTeam(team: string): string[] {
  const years = TEAM_YEAR_ROSTERS[team];
  if (!years) return [];
  return Object.keys(years)
    .filter((year) => passesYearGate(team, year))
    .filter((year) => hasTeamYearRoster(team, year, "current"))
    .sort((a, b) => Number(b) - Number(a));
}

export function getEraYearsForTeam(team: string): string[] {
  const years = TEAM_YEAR_ROSTERS[team];
  if (!years) return [];
  return Object.keys(years)
    .filter((year) => passesYearGate(team, year))
    .filter((year) => year !== CURRENT_SEASON_YEAR)
    .filter((year) => hasTeamYearRoster(team, year, "era"))
    .sort((a, b) => Number(b) - Number(a));
}

/** Union of all roster player IDs for a team across available years. */
export function getRosterPlayerIdsForTeamAllYears(team: string): string[] {
  const ids = new Set<string>();
  for (const year of getYearsForTeam(team)) {
    for (const id of getRosterPlayerIds(team, year)) {
      ids.add(id);
    }
  }
  for (const year of getEraYearsForTeam(team)) {
    for (const id of getRosterPlayerIds(team, year)) {
      ids.add(id);
    }
  }
  return [...ids];
}

export function getRosterPlayerIds(team: string, year: string): string[] {
  return rosterIds(team, year);
}

export function hasTeamYearRoster(
  team: string,
  year: string,
  mode: "current" | "era" | "any" = "any"
): boolean {
  if (!passesYearGate(team, year)) return false;

  const ids = rosterIds(team, year);
  const { getPlayerById } = require("./index") as typeof import("./index");

  if (mode === "current") {
    if (!isCurrentPlayableClub(team)) return false;
    if (!isTeamYearPlayableInNormalSpin(team, year)) return false;
    return isPlayableTeamYearRoster(team, year, ids, getPlayerById);
  }

  if (mode === "era") {
    if (!isEraPlayableClub(team)) return false;
    if (year === CURRENT_SEASON_YEAR) return false;
    if (!isTeamYearPlayableInEra(team, year)) return false;
    return isPlayableTeamYearRoster(team, year, ids, getPlayerById);
  }

  const meta = getTeamYearRosterMeta(team, year);
  if (!meta) return false;
  return isPlayableTeamYearRoster(team, year, ids, getPlayerById);
}

/** Raw roster exists (any count) — for data tooling, not gameplay pools. */
export function hasRawTeamYearRoster(team: string, year: string): boolean {
  return rosterIds(team, year).length > 0;
}

export interface TeamYearRosterEntry {
  team: string;
  year: string;
}

/** All player IDs that appear in any team-year roster (display-layer capped years). */
export function getAllRosterPlayerIds(): Set<string> {
  const ids = new Set<string>();
  for (const team of getAllTeamsInYearRosters()) {
    const years = TEAM_YEAR_ROSTERS[team];
    if (!years) continue;
    for (const year of Object.keys(years)) {
      if (!passesYearGate(team, year)) continue;
      for (const id of rosterIds(team, year)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/** playerId → roster appearances for Team > Year browse sorting. */
export function buildTeamYearRosterIndex(): Map<string, TeamYearRosterEntry[]> {
  const index = new Map<string, TeamYearRosterEntry[]>();
  for (const team of getAllTeamsInYearRosters()) {
    const years = TEAM_YEAR_ROSTERS[team];
    if (!years) continue;
    for (const year of Object.keys(years)) {
      if (!passesYearGate(team, year)) continue;
      for (const id of rosterIds(team, year)) {
        const list = index.get(id) ?? [];
        list.push({ team, year });
        index.set(id, list);
      }
    }
  }
  return index;
}

export { getCurrentPlayableClubNames, getEraPlayableClubNames };
