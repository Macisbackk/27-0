import teamYearRostersData from "../../../data/team-year-rosters.json";
import { getPlayableClubNames } from "../clubs/super-league-display";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

const TEAM_YEAR_ROSTERS = teamYearRostersData as TeamYearRosters;

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
  return Object.keys(years).sort((a, b) => Number(b) - Number(a));
}

export function getRosterPlayerIds(team: string, year: string): string[] {
  return TEAM_YEAR_ROSTERS[team]?.[year] ?? [];
}

export function hasTeamYearRoster(team: string, year: string): boolean {
  return (TEAM_YEAR_ROSTERS[team]?.[year]?.length ?? 0) > 0;
}
