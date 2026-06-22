import { isSuperLeagueSeason } from "./super-league-club-years";
import teamYearRostersData from "../../../data/team-year-rosters.json";
import { getPlayableClubNames } from "../clubs/super-league-display";
import {
  isPlayableTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
} from "./team-year-roster-playable";
import { isTeamYearPlayableInNormalSpin } from "./team-year-roster-meta";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

const TEAM_YEAR_ROSTERS = teamYearRostersData as TeamYearRosters;

export { MIN_TEAM_YEAR_ROSTER_PLAYERS };

export function getCurrentCalendarYear(): number {
  return new Date().getFullYear();
}

export function getTeamYearRosters(): TeamYearRosters {
  return TEAM_YEAR_ROSTERS;
}

export function getTeamsWithYearRosters(): string[] {
  const playable = new Set(getPlayableClubNames());
  return Object.keys(TEAM_YEAR_ROSTERS)
    .filter((team) => playable.has(team))
    .sort((a, b) => a.localeCompare(b));
}

export function getYearsForTeam(team: string): string[] {
  const years = TEAM_YEAR_ROSTERS[team];
  if (!years) return [];
  const currentYear = getCurrentCalendarYear();
  return Object.keys(years)
    .filter((year) => Number(year) <= currentYear)
    .filter((year) => isSuperLeagueSeason(team, year))
    .filter((year) => hasTeamYearRoster(team, year))
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
  return [...ids];
}

export function getRosterPlayerIds(team: string, year: string): string[] {
  return TEAM_YEAR_ROSTERS[team]?.[year] ?? [];
}

export function hasTeamYearRoster(team: string, year: string): boolean {
  if (!isSuperLeagueSeason(team, year)) return false;
  if (!isTeamYearPlayableInNormalSpin(team, year)) return false;
  const ids = TEAM_YEAR_ROSTERS[team]?.[year] ?? [];
  const { getPlayerById } = require("./index") as typeof import("./index");
  return isPlayableTeamYearRoster(team, year, ids, getPlayerById);
}

/** Raw roster exists (any count) — for data tooling, not gameplay pools. */
export function hasRawTeamYearRoster(team: string, year: string): boolean {
  return (TEAM_YEAR_ROSTERS[team]?.[year]?.length ?? 0) > 0;
}

export interface TeamYearRosterEntry {
  team: string;
  year: string;
}

/** All player IDs that appear in any team-year roster (display-layer capped years). */
export function getAllRosterPlayerIds(): Set<string> {
  const ids = new Set<string>();
  for (const team of getTeamsWithYearRosters()) {
    for (const year of getYearsForTeam(team)) {
      for (const id of getRosterPlayerIds(team, year)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/** playerId → roster appearances for Team > Year browse sorting. */
export function buildTeamYearRosterIndex(): Map<string, TeamYearRosterEntry[]> {
  const index = new Map<string, TeamYearRosterEntry[]>();
  for (const team of getTeamsWithYearRosters()) {
    for (const year of getYearsForTeam(team)) {
      for (const id of getRosterPlayerIds(team, year)) {
        const list = index.get(id) ?? [];
        list.push({ team, year });
        index.set(id, list);
      }
    }
  }
  return index;
}
