import teamYearRostersMetaData from "../../../data/team-year-rosters-meta.json";

export type TeamYearRosterMeta = {
  source: "verified" | "current-squad";
  isSuperLeagueSeason: boolean;
  playableInNormalSpin: boolean;
  playableInEra: boolean;
  playerCount: number;
  verifiedSource?: string;
};

const META = teamYearRostersMetaData as Record<
  string,
  Record<string, TeamYearRosterMeta>
>;

export function getTeamYearRosterMeta(
  team: string,
  year: string
): TeamYearRosterMeta | null {
  return META[team]?.[year] ?? null;
}

export function isTeamYearPlayableInNormalSpin(
  team: string,
  year: string
): boolean {
  return getTeamYearRosterMeta(team, year)?.playableInNormalSpin === true;
}

export function isTeamYearPlayableInEra(team: string, year: string): boolean {
  return getTeamYearRosterMeta(team, year)?.playableInEra === true;
}
