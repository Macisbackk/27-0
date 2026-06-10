import {
  DREAM_TEAM_NAME,
  type SeasonResult,
} from "./season-simulation";
import { getSeasonLeagueClubs } from "./league-replacement";
import { buildTeamSeasonStats, type TeamSeasonStats } from "./team-season-stats";

export interface LeagueTableRow {
  position: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  leaguePoints: number;
  isUserTeam: boolean;
}

function getLeagueTeams(seed: string): string[] {
  return getSeasonLeagueClubs(seed).leagueTeams;
}

function toLeagueRow(stats: TeamSeasonStats): LeagueTableRow {
  return {
    position: 0,
    team: stats.team,
    played: stats.played,
    wins: stats.wins,
    losses: stats.losses,
    pointsFor: stats.pointsFor,
    pointsAgainst: stats.pointsAgainst,
    pointsDifference: stats.pointsDifference,
    leaguePoints: stats.leaguePoints,
    isUserTeam: stats.isUserTeam,
  };
}

function sortStandings(rows: LeagueTableRow[]): LeagueTableRow[] {
  rows.sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    if (b.pointsDifference !== a.pointsDifference) {
      return b.pointsDifference - a.pointsDifference;
    }
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.team.localeCompare(b.team);
  });

  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

/**
 * Builds a full league table for the season.
 * Dream Team stats come from actual simulated fixtures; remaining fixtures
 * between other clubs are simulated deterministically from the same seed.
 */
export function buildLeagueTable(
  seasonResult: SeasonResult,
  seed: string
): LeagueTableRow[] {
  const leagueTeams = getLeagueTeams(seed);
  const statsMap = buildTeamSeasonStats(seasonResult, seed);
  const rows = leagueTeams.map((team) =>
    toLeagueRow(statsMap.get(team) ?? {
      team,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDifference: 0,
      triesFor: 0,
      triesAgainst: 0,
      leaguePoints: 0,
      isUserTeam: team === DREAM_TEAM_NAME,
    })
  );

  return sortStandings(rows);
}
