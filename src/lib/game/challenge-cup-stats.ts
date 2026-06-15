import type { SquadSlot } from "../types";
import type { BracketMatch } from "./challenge-cup-bracket";
import type { MatchFixture } from "./season-simulation";
import {
  aggregateTryTotalsFromFixtures,
  getSeasonTryTotal,
  validateAndReconcileSeasonTries,
  type PlayerTryTotal,
} from "./season-tries";
import { formatWinPercentage } from "../team-value-comparison";

export interface ChallengeCupTournamentStats {
  wins: number;
  losses: number;
  matchesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
  winPct: string;
  biggestWin: {
    opponent: string;
    pointsFor: number;
    pointsAgainst: number;
    margin: number;
  } | null;
  biggestLoss: {
    opponent: string;
    pointsFor: number;
    pointsAgainst: number;
    margin: number;
  } | null;
}

function sumTryScorers(
  scorers: { tries: number }[] | undefined
): number {
  return (scorers ?? []).reduce((sum, scorer) => sum + scorer.tries, 0);
}

/** Tries conceded by a club across all completed bracket matches. */
export function getClubBracketTriesConceded(
  club: string,
  matches: BracketMatch[]
): number {
  let total = 0;
  for (const match of matches) {
    if (match.status !== "complete" || !match.scoringDetail) continue;
    if (match.homeTeam === club) {
      total += sumTryScorers(match.scoringDetail.away.tryScorers);
    } else if (match.awayTeam === club) {
      total += sumTryScorers(match.scoringDetail.home.tryScorers);
    }
  }
  return total;
}

/** Tries scored by a club across all completed bracket matches. */
export function getClubBracketTriesScored(
  club: string,
  matches: BracketMatch[]
): number {
  let total = 0;
  for (const match of matches) {
    if (match.status !== "complete" || !match.scoringDetail) continue;
    if (match.homeTeam === club) {
      total += sumTryScorers(match.scoringDetail.home.tryScorers);
    } else if (match.awayTeam === club) {
      total += sumTryScorers(match.scoringDetail.away.tryScorers);
    }
  }
  return total;
}

export interface BracketTeamTournamentStats {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
}

function emptyBracketTeamStats(name: string): BracketTeamTournamentStats {
  return {
    name,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    triesFor: 0,
    triesAgainst: 0,
  };
}

/** Aggregate tournament performance for every team in a completed bracket. */
export function getBracketTeamTournamentStats(
  matches: BracketMatch[]
): Map<string, BracketTeamTournamentStats> {
  const stats = new Map<string, BracketTeamTournamentStats>();

  const ensure = (name: string) => {
    if (!stats.has(name)) stats.set(name, emptyBracketTeamStats(name));
    return stats.get(name)!;
  };

  for (const match of matches) {
    if (match.status !== "complete") continue;
    const { homeTeam, awayTeam, homeScore, awayScore, winner, loser } = match;
    if (!homeTeam || !awayTeam || homeScore === null || awayScore === null) {
      continue;
    }

    const home = ensure(homeTeam);
    const away = ensure(awayTeam);
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;

    if (match.scoringDetail) {
      home.triesFor += sumTryScorers(match.scoringDetail.home.tryScorers);
      home.triesAgainst += sumTryScorers(match.scoringDetail.away.tryScorers);
      away.triesFor += sumTryScorers(match.scoringDetail.away.tryScorers);
      away.triesAgainst += sumTryScorers(match.scoringDetail.home.tryScorers);
    }

    if (winner === homeTeam) {
      home.wins++;
      if (loser === awayTeam) away.losses++;
    } else if (winner === awayTeam) {
      away.wins++;
      if (loser === homeTeam) home.losses++;
    }
  }

  return stats;
}

/** User try totals derived only from recorded match events on fixtures. */
export function deriveCupTryScorersFromMatchEvents(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  seed: string,
  wins: number
): PlayerTryTotal[] {
  return validateAndReconcileSeasonTries(squad, fixtures, seed, wins);
}

export function buildChallengeCupTournamentStats(
  fixtures: MatchFixture[]
): ChallengeCupTournamentStats {
  const wins = fixtures.filter((fixture) => fixture.result === "W").length;
  const losses = fixtures.length - wins;
  const pointsFor = fixtures.reduce((sum, fixture) => sum + fixture.pointsFor, 0);
  const pointsAgainst = fixtures.reduce(
    (sum, fixture) => sum + fixture.pointsAgainst,
    0
  );
  const triesFor = getSeasonTryTotal(fixtures);
  const triesAgainst = fixtures.reduce(
    (sum, fixture) => sum + fixture.triesAgainst,
    0
  );

  let biggestWin: ChallengeCupTournamentStats["biggestWin"] = null;
  let biggestLoss: ChallengeCupTournamentStats["biggestLoss"] = null;

  for (const fixture of fixtures) {
    const margin = fixture.pointsFor - fixture.pointsAgainst;
    if (fixture.result === "W") {
      if (!biggestWin || margin > biggestWin.margin) {
        biggestWin = {
          opponent: fixture.opponent,
          pointsFor: fixture.pointsFor,
          pointsAgainst: fixture.pointsAgainst,
          margin,
        };
      }
    } else if (!biggestLoss || margin < biggestLoss.margin) {
      biggestLoss = {
        opponent: fixture.opponent,
        pointsFor: fixture.pointsFor,
        pointsAgainst: fixture.pointsAgainst,
        margin,
      };
    }
  }

  return {
    wins,
    losses,
    matchesPlayed: fixtures.length,
    pointsFor,
    pointsAgainst,
    triesFor,
    triesAgainst,
    winPct: formatWinPercentage(wins, losses),
    biggestWin,
    biggestLoss,
  };
}

export function validateCupTryTotals(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  tryScorers: PlayerTryTotal[]
): string[] {
  const issues: string[] = [];
  const expectedTries = getSeasonTryTotal(fixtures);
  const listedTotal = tryScorers.reduce((sum, scorer) => sum + scorer.tries, 0);
  const eventTotal = aggregateTryTotalsFromFixtures(squad, fixtures).reduce(
    (sum, scorer) => sum + scorer.tries,
    0
  );

  if (listedTotal !== expectedTries) {
    issues.push(
      `Try scorer list (${listedTotal}) ≠ fixture tries (${expectedTries})`
    );
  }
  if (eventTotal !== expectedTries) {
    issues.push(
      `Match event tries (${eventTotal}) ≠ fixture tries (${expectedTries})`
    );
  }
  if (listedTotal !== eventTotal) {
    issues.push(
      `Try scorer list (${listedTotal}) ≠ match event aggregate (${eventTotal})`
    );
  }

  for (const fixture of fixtures) {
    const eventTries = sumTryScorers(
      fixture.scoringDetail?.dreamTeam.tryScorers
    );
    if (eventTries !== fixture.triesFor) {
      issues.push(
        `Round ${fixture.round}: match events (${eventTries}) ≠ triesFor (${fixture.triesFor})`
      );
    }
  }

  return issues;
}
