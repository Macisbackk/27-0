import seedrandom from "seedrandom";
import {
  decomposeRLScore,
  pickRLScore,
  snapToRLScore,
} from "./rl-scores";
import {
  DREAM_TEAM_NAME,
  SEASON_GAMES,
  type MatchFixture,
  type SeasonResult,
} from "./season-simulation";
import { getSeasonLeagueClubs } from "./league-replacement";
import { getClubBaseStrength } from "./club-strength";
import { getSeasonTryTotal } from "./season-tries";
import { devWarnMany } from "../validation/dev-warn";

export interface SeasonMatchResult {
  round: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
  winner: string;
  loser: string;
}

export interface TeamSeasonStats {
  team: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  triesFor: number;
  triesAgainst: number;
  leaguePoints: number;
  isUserTeam: boolean;
}

interface TeamAccumulator {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
}

function getLeagueTeams(seed: string): string[] {
  return getSeasonLeagueClubs(seed).leagueTeams;
}

function emptyAccumulator(): TeamAccumulator {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    triesFor: 0,
    triesAgainst: 0,
  };
}

function recordMatch(
  stats: Map<string, TeamAccumulator>,
  teamA: string,
  scoreA: number,
  triesA: number,
  teamB: string,
  scoreB: number,
  triesB: number
): void {
  const a = stats.get(teamA) ?? emptyAccumulator();
  const b = stats.get(teamB) ?? emptyAccumulator();

  a.played++;
  b.played++;
  a.pointsFor += scoreA;
  a.pointsAgainst += scoreB;
  b.pointsFor += scoreB;
  b.pointsAgainst += scoreA;
  a.triesFor += triesA;
  a.triesAgainst += triesB;
  b.triesFor += triesB;
  b.triesAgainst += triesA;

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
): { homeScore: number; awayScore: number; homeTries: number; awayTries: number } {
  const rng = seedrandom(`${seed}-league-club-r${round}-${home}-${away}`);
  const homeStr = getClubBaseStrength(home) + 2;
  const awayStr = getClubBaseStrength(away);
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

  const homeTries = decomposeRLScore(homeScore).tries;
  const awayTries = decomposeRLScore(awayScore).tries;

  return { homeScore, awayScore, homeTries, awayTries };
}

/**
 * Builds every match in the season league schedule from user fixtures and
 * deterministic inter-club simulations.
 */
export function buildSeasonMatchResults(
  seasonResult: SeasonResult,
  seed: string
): SeasonMatchResult[] {
  const leagueTeams = getLeagueTeams(seed);
  const matches: SeasonMatchResult[] = [];

  for (let round = 1; round <= SEASON_GAMES; round++) {
    const dtFixture = seasonResult.fixtures[round - 1];
    if (!dtFixture) continue;

    const homeTeam = dtFixture.isHome ? DREAM_TEAM_NAME : dtFixture.opponent;
    const awayTeam = dtFixture.isHome ? dtFixture.opponent : DREAM_TEAM_NAME;
    const homeScore = dtFixture.isHome
      ? dtFixture.pointsFor
      : dtFixture.pointsAgainst;
    const awayScore = dtFixture.isHome
      ? dtFixture.pointsAgainst
      : dtFixture.pointsFor;
    const homeTries = dtFixture.isHome
      ? dtFixture.triesFor
      : dtFixture.triesAgainst;
    const awayTries = dtFixture.isHome
      ? dtFixture.triesAgainst
      : dtFixture.triesFor;

    matches.push({
      round,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      homeTries,
      awayTries,
      winner: homeScore > awayScore ? homeTeam : awayTeam,
      loser: homeScore > awayScore ? awayTeam : homeTeam,
    });

    const resting = leagueTeams.filter(
      (t) => t !== DREAM_TEAM_NAME && t !== dtFixture.opponent
    );
    const pairs = pairTeamsForRound(resting, round, seed);

    for (const [home, away] of pairs) {
      const { homeScore: hScore, awayScore: aScore, homeTries: hTries, awayTries: aTries } =
        simulateClubFixture(home, away, round, seed);
      matches.push({
        round,
        homeTeam: home,
        awayTeam: away,
        homeScore: hScore,
        awayScore: aScore,
        homeTries: hTries,
        awayTries: aTries,
        winner: hScore > aScore ? home : away,
        loser: hScore > aScore ? away : home,
      });
    }
  }

  return matches;
}

/**
 * Single source of truth for full-season team stats (league table, comparison, validation).
 */
export function buildTeamSeasonStats(
  seasonResult: SeasonResult,
  seed: string
): Map<string, TeamSeasonStats> {
  const leagueTeams = getLeagueTeams(seed);
  const stats = new Map<string, TeamAccumulator>();
  for (const team of leagueTeams) {
    stats.set(team, emptyAccumulator());
  }

  for (const match of buildSeasonMatchResults(seasonResult, seed)) {
    recordMatch(
      stats,
      match.homeTeam,
      match.homeScore,
      match.homeTries,
      match.awayTeam,
      match.awayScore,
      match.awayTries
    );
  }

  const dreamTeam = stats.get(DREAM_TEAM_NAME)!;
  dreamTeam.wins = seasonResult.wins;
  dreamTeam.losses = seasonResult.losses;
  dreamTeam.played = seasonResult.wins + seasonResult.losses;
  dreamTeam.pointsFor = seasonResult.pointsFor;
  dreamTeam.pointsAgainst = seasonResult.pointsAgainst;
  dreamTeam.triesFor = getSeasonTryTotal(seasonResult.fixtures);
  dreamTeam.triesAgainst = seasonResult.fixtures.reduce(
    (sum, f) => sum + f.triesAgainst,
    0
  );
  stats.set(DREAM_TEAM_NAME, dreamTeam);

  const result = new Map<string, TeamSeasonStats>();
  for (const team of leagueTeams) {
    const s = stats.get(team) ?? emptyAccumulator();
    result.set(team, {
      team,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointsDifference: s.pointsFor - s.pointsAgainst,
      triesFor: s.triesFor,
      triesAgainst: s.triesAgainst,
      leaguePoints: s.wins * 2,
      isUserTeam: team === DREAM_TEAM_NAME,
    });
  }

  return result;
}

export function getTeamSeasonStats(
  teamName: string,
  seasonResult: SeasonResult,
  seed: string
): TeamSeasonStats | null {
  return buildTeamSeasonStats(seasonResult, seed).get(teamName) ?? null;
}

/** Sum tries scored by a team across head-to-head fixtures only (cup / knockout). */
export function getHeadToHeadTries(
  teamName: string,
  fixtures: MatchFixture[],
  perspective: "user" | "opponent"
): number {
  if (perspective === "user") {
    return fixtures.reduce((sum, f) => sum + f.triesFor, 0);
  }
  const vsUser = fixtures.filter((f) => f.opponent === teamName);
  return vsUser.reduce((sum, f) => sum + f.triesAgainst, 0);
}

export function validateTeamSeasonStats(
  seasonResult: SeasonResult,
  seed: string
): string[] {
  const issues: string[] = [];
  const statsMap = buildTeamSeasonStats(seasonResult, seed);
  const dreamRow = statsMap.get(DREAM_TEAM_NAME);
  const { wins, losses, pointsFor, pointsAgainst, fixtures } = seasonResult;

  if (!dreamRow) {
    issues.push("Dream Team missing from team season stats");
    return issues;
  }

  if (dreamRow.wins !== wins) {
    issues.push(
      `Team stats wins (${dreamRow.wins}) ≠ season wins (${wins})`
    );
  }
  if (dreamRow.losses !== losses) {
    issues.push(
      `Team stats losses (${dreamRow.losses}) ≠ season losses (${losses})`
    );
  }
  if (dreamRow.pointsFor !== pointsFor) {
    issues.push(
      `Team stats PF (${dreamRow.pointsFor}) ≠ season PF (${pointsFor})`
    );
  }
  if (dreamRow.pointsAgainst !== pointsAgainst) {
    issues.push(
      `Team stats PA (${dreamRow.pointsAgainst}) ≠ season PA (${pointsAgainst})`
    );
  }

  const fixtureTryTotal = getSeasonTryTotal(fixtures);
  if (dreamRow.triesFor !== fixtureTryTotal) {
    issues.push(
      `Team stats tries for (${dreamRow.triesFor}) ≠ fixture tries (${fixtureTryTotal})`
    );
  }

  for (const fixture of fixtures) {
    const oppStats = statsMap.get(fixture.opponent);
    if (!oppStats) continue;

    const matchTries = fixture.triesAgainst;
    const eventTries =
      fixture.scoringDetail?.opponent.tryScorers.reduce(
        (sum, s) => sum + s.tries,
        0
      ) ?? matchTries;

    if (eventTries !== matchTries) {
      issues.push(
        `Round ${fixture.round} ${fixture.opponent}: match events (${eventTries}) ≠ triesAgainst (${matchTries})`
      );
    }
  }

  return issues;
}

export function runTeamSeasonStatsValidation(
  seasonResult: SeasonResult,
  seed: string
): void {
  const issues = validateTeamSeasonStats(seasonResult, seed);
  devWarnMany("team-season-stats", issues, {
    wins: seasonResult.wins,
    losses: seasonResult.losses,
  });
}
