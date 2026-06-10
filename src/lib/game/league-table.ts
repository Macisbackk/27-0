import seedrandom from "seedrandom";
import { SUPER_LEAGUE_CLUBS } from "../clubs";
import {
  DREAM_TEAM_NAME,
  SEASON_GAMES,
  type SeasonResult,
} from "./season-simulation";
import { pickRLScore, snapToRLScore } from "./rl-scores";

/** Club strength tiers — aligned with season opponent modelling. */
const CLUB_STRENGTH: Record<string, number> = {
  "Wigan Warriors": 84,
  "St Helens": 83,
  "Leeds Rhinos": 81,
  "Warrington Wolves": 80,
  "Hull KR": 79,
  "Catalans Dragons": 78,
  "Hull FC": 76,
  "Leigh Leopards": 75,
  "Huddersfield Giants": 73,
  "Salford Red Devils": 72,
  "Castleford Tigers": 70,
  "Bradford Bulls": 69,
  "Wakefield Trinity": 66,
  "London Broncos": 60,
  "Widnes Vikings": 62,
  "Halifax Panthers": 61,
  "York Knights": 74,
  "Toulouse Olympique": 76,
};

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

interface TeamAccumulator {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

function getLeagueTeams(): string[] {
  const opponents = SUPER_LEAGUE_CLUBS.filter((c) => c.active !== false)
    .map((c) => c.name)
    .slice(0, 13);
  return [DREAM_TEAM_NAME, ...opponents];
}

function emptyAccumulator(): TeamAccumulator {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function recordMatch(
  stats: Map<string, TeamAccumulator>,
  teamA: string,
  scoreA: number,
  teamB: string,
  scoreB: number
): void {
  const a = stats.get(teamA) ?? emptyAccumulator();
  const b = stats.get(teamB) ?? emptyAccumulator();

  a.played++;
  b.played++;
  a.pointsFor += scoreA;
  a.pointsAgainst += scoreB;
  b.pointsFor += scoreB;
  b.pointsAgainst += scoreA;

  if (scoreA > scoreB) {
    a.wins++;
    b.losses++;
  } else {
    b.wins++;
    a.losses++;
  }

  stats.set(teamA, a);
  stats.set(teamB, b);
}

function pairTeamsForRound(
  teams: string[],
  round: number,
  seed: string
): [string, string][] {
  const rng = seedrandom(`${seed}-league-pair-r${round}`);
  const shuffled = [...teams].sort(() => rng() - 0.5);
  const pairs: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

function simulateClubFixture(
  home: string,
  away: string,
  round: number,
  seed: string
): { homeScore: number; awayScore: number } {
  const rng = seedrandom(`${seed}-league-club-r${round}-${home}-${away}`);
  const homeStr = (CLUB_STRENGTH[home] ?? 70) + 2;
  const awayStr = CLUB_STRENGTH[away] ?? 70;
  const diff = homeStr - awayStr + (rng() - 0.5) * 10;
  const homeWins = rng() < 1 / (1 + Math.exp(-diff / 4.2));

  const winnerMin = 14;
  const winnerMax = 36;
  const loserMin = 0;
  const loserMax = 24;

  let homeScore: number;
  let awayScore: number;

  if (homeWins) {
    homeScore = snapToRLScore(
      pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal: true }),
      true
    );
    awayScore = snapToRLScore(
      pickRLScore(loserMin, loserMax, rng, { allowDropGoal: false }),
      false
    );
    if (homeScore <= awayScore) homeScore = awayScore + 2;
  } else {
    awayScore = snapToRLScore(
      pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal: true }),
      true
    );
    homeScore = snapToRLScore(
      pickRLScore(loserMin, loserMax, rng, { allowDropGoal: false }),
      false
    );
    if (awayScore <= homeScore) awayScore = homeScore + 2;
  }

  return { homeScore, awayScore };
}

function sortStandings(
  teams: string[],
  stats: Map<string, TeamAccumulator>
): LeagueTableRow[] {
  const rows = teams.map((team) => {
    const s = stats.get(team) ?? emptyAccumulator();
    const pointsDifference = s.pointsFor - s.pointsAgainst;
    return {
      position: 0,
      team,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointsDifference,
      leaguePoints: s.wins * 2,
      isUserTeam: team === DREAM_TEAM_NAME,
    };
  });

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
  const leagueTeams = getLeagueTeams();
  const stats = new Map<string, TeamAccumulator>();
  for (const team of leagueTeams) {
    stats.set(team, emptyAccumulator());
  }

  for (let round = 1; round <= SEASON_GAMES; round++) {
    const dtFixture = seasonResult.fixtures[round - 1];
    if (!dtFixture) continue;

    recordMatch(
      stats,
      DREAM_TEAM_NAME,
      dtFixture.pointsFor,
      dtFixture.opponent,
      dtFixture.pointsAgainst
    );

    const resting = leagueTeams.filter(
      (t) => t !== DREAM_TEAM_NAME && t !== dtFixture.opponent
    );
    const pairs = pairTeamsForRound(resting, round, seed);

    for (const [home, away] of pairs) {
      const { homeScore, awayScore } = simulateClubFixture(
        home,
        away,
        round,
        seed
      );
      recordMatch(stats, home, homeScore, away, awayScore);
    }
  }

  const dreamTeam = stats.get(DREAM_TEAM_NAME)!;
  dreamTeam.wins = seasonResult.wins;
  dreamTeam.losses = seasonResult.losses;
  dreamTeam.played = seasonResult.wins + seasonResult.losses;
  dreamTeam.pointsFor = seasonResult.pointsFor;
  dreamTeam.pointsAgainst = seasonResult.pointsAgainst;
  stats.set(DREAM_TEAM_NAME, dreamTeam);

  return sortStandings(leagueTeams, stats);
}
