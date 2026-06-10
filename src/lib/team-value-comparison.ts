import type { MatchFixture } from "./game/season-simulation";
import {
  getOpponentSquadValue,
  getOpponentTeamSummary,
} from "./game/opponent-scorers";

export interface TeamValueEntry {
  name: string;
  value: number;
}

export interface TeamRatingEntry {
  name: string;
  rating: number;
}

export interface TeamComparisonSummary {
  myTeamRating: number;
  myTeamValue: number;
  bestRatedTeam: TeamRatingEntry;
  mostExpensiveTeam: TeamValueEntry;
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

  let best: TeamRatingEntry = { name: userTeamName, rating: userRating };
  for (const [name, rating] of teams) {
    if (rating > best.rating) best = { name, rating };
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
