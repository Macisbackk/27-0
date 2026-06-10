import type { MatchFixture } from "./game/season-simulation";
import {
  getOpponentSquadValue,
  getOpponentTeamSummary,
  selectClubMatchSquad,
} from "./game/opponent-scorers";
import { getEffectivePeakRating } from "./squad-analysis";
import { getTeamTier } from "./team-tiers";
import type { SquadSlot } from "./types";

export interface TeamValueEntry {
  name: string;
  value: number;
}

export interface TeamRatingEntry {
  name: string;
  rating: number;
  tier: string;
}

export interface TeamComparisonSummary {
  myTeamRating: number;
  myTeamTier: string;
  myTeamValue: number;
  bestRatedTeam: TeamRatingEntry;
  mostExpensiveTeam: TeamValueEntry;
}

export interface TeamPlayerHighlight {
  name: string;
  rating: number;
}

export interface TeamSideDisplay {
  name: string;
  rating: number;
  tier: string;
  value: number;
  winPct: string;
  totalTries: number;
  topPlayer: TeamPlayerHighlight;
}

export interface ExtendedTeamComparison {
  user: TeamSideDisplay;
  opponent: TeamSideDisplay;
  mostExpensiveTeam: TeamValueEntry;
  ratingEdge: "user" | "opponent" | "tie";
}

function getTopPlayerFromSquad(
  club: string,
  seed: string,
  round: number
): TeamPlayerHighlight {
  const squad = selectClubMatchSquad(club, seed, round);
  if (squad.length === 0) return { name: "—", rating: 0 };
  const best = squad.reduce((a, b) =>
    b.peakRating > a.peakRating ? b : a
  );
  return { name: best.name, rating: best.peakRating };
}

function getUserTopPlayer(squad: SquadSlot[]): TeamPlayerHighlight {
  let best: TeamPlayerHighlight = { name: "—", rating: 0 };
  for (const slot of squad) {
    if (!slot.player) continue;
    const rating = getEffectivePeakRating(slot);
    if (rating > best.rating) {
      best = { name: slot.player.name, rating };
    }
  }
  return best;
}

function getOpponentFixtureStats(
  opponentName: string,
  fixtures: MatchFixture[]
): { winPct: string; totalTries: number } {
  const vsUser = fixtures.filter((f) => f.opponent === opponentName);
  if (vsUser.length === 0) {
    return { winPct: "—", totalTries: 0 };
  }
  const oppWins = vsUser.filter((f) => f.result === "L").length;
  const winPct = `${Math.round((oppWins / vsUser.length) * 100)}%`;
  const totalTries = vsUser.reduce((sum, f) => sum + f.triesAgainst, 0);
  return { winPct, totalTries };
}

function findBestOpponentRound(
  opponentName: string,
  fixtures: MatchFixture[],
  seed: string
): number {
  let bestRound = fixtures[0]?.round ?? 1;
  let bestRating = 0;
  for (const fixture of fixtures) {
    if (fixture.opponent !== opponentName) continue;
    const opp = getOpponentTeamSummary(
      fixture.opponent,
      seed,
      fixture.round
    );
    if (opp.averageRating > bestRating) {
      bestRating = opp.averageRating;
      bestRound = fixture.round;
    }
  }
  return bestRound;
}

export function formatWinPercentage(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

export function getMostExpensiveTeam(
  userTeamName: string,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string
): TeamValueEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userValue);

  for (const fixture of fixtures) {
    const oppValue = getOpponentSquadValue(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, oppValue));
  }

  let best: TeamValueEntry = { name: userTeamName, value: userValue };
  for (const [name, value] of teams) {
    if (value > best.value) best = { name, value };
  }
  return best;
}

export function getBestRatedTeam(
  userTeamName: string,
  userRating: number,
  fixtures: MatchFixture[],
  seed: string
): TeamRatingEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userRating);

  for (const fixture of fixtures) {
    const opp = getOpponentTeamSummary(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, opp.averageRating));
  }

  let best: TeamRatingEntry = {
    name: userTeamName,
    rating: userRating,
    tier: getTeamTier(userRating),
  };
  for (const [name, rating] of teams) {
    if (rating > best.rating) {
      best = { name, rating, tier: getTeamTier(rating) };
    }
  }
  return best;
}

export function getTeamComparisonSummary(
  userTeamName: string,
  userRating: number,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string
): TeamComparisonSummary {
  return {
    myTeamRating: userRating,
    myTeamTier: getTeamTier(userRating),
    myTeamValue: userValue,
    bestRatedTeam: getBestRatedTeam(
      userTeamName,
      userRating,
      fixtures,
      seed
    ),
    mostExpensiveTeam: getMostExpensiveTeam(
      userTeamName,
      userValue,
      fixtures,
      seed
    ),
  };
}

export function getExtendedTeamComparison(
  userTeamName: string,
  userRating: number,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string,
  options: { squad: SquadSlot[]; wins: number; losses: number }
): ExtendedTeamComparison {
  const summary = getTeamComparisonSummary(
    userTeamName,
    userRating,
    userValue,
    fixtures,
    seed
  );
  const { bestRatedTeam, mostExpensiveTeam } = summary;
  const userTotalTries = fixtures.reduce((sum, f) => sum + f.triesFor, 0);
  const oppStats = getOpponentFixtureStats(bestRatedTeam.name, fixtures);
  const oppRound = findBestOpponentRound(bestRatedTeam.name, fixtures, seed);
  const oppValue =
    bestRatedTeam.name === userTeamName
      ? userValue
      : getOpponentSquadValue(bestRatedTeam.name, seed, oppRound);

  const ratingEdge: ExtendedTeamComparison["ratingEdge"] =
    userRating > bestRatedTeam.rating
      ? "user"
      : userRating < bestRatedTeam.rating
        ? "opponent"
        : "tie";

  return {
    user: {
      name: userTeamName,
      rating: userRating,
      tier: summary.myTeamTier,
      value: userValue,
      winPct: formatWinPercentage(options.wins, options.losses),
      totalTries: userTotalTries,
      topPlayer: getUserTopPlayer(options.squad),
    },
    opponent: {
      name: bestRatedTeam.name,
      rating: bestRatedTeam.rating,
      tier: bestRatedTeam.tier,
      value: oppValue,
      winPct: oppStats.winPct,
      totalTries: oppStats.totalTries,
      topPlayer: getTopPlayerFromSquad(bestRatedTeam.name, seed, oppRound),
    },
    mostExpensiveTeam,
    ratingEdge,
  };
}
