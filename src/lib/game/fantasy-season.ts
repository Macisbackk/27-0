import type { SquadSlot } from "../types";
import { getAverageSquadRating } from "../squad-analysis";
import { getOpponentMatchRating } from "./opponent-scorers";
import { getSeasonLeagueClubs } from "./league-replacement";
import {
  SEASON_GAMES,
  simulateOneFixture,
  calculateSquadStrength,
  generateSeasonInsights,
  type MatchFixture,
  type MatchSimState,
  type SeasonResult,
  type ScheduledFixture,
  buildSeasonSchedule,
} from "./season-simulation";
import { getDreamTeamTablePosition } from "./league-table";
import {
  distributeSeasonTries,
  enrichSingleFixtureScoring,
} from "./season-tries";
import { enrichFantasyFixtureSummary } from "./fantasy-match-summary";

export type { ScheduledFixture };

export interface FantasySeasonState {
  seed: string;
  squad: SquadSlot[];
  schedule: ScheduledFixture[];
  replacedTeam: string;
  fixtures: MatchFixture[];
  currentRound: number;
  matchSimState: MatchSimState;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gameResults: ("W" | "L")[];
  isComplete: boolean;
}

function getOpponentMatchRatingForFantasy(
  opponent: string,
  seed: string,
  round: number
): number {
  return getOpponentMatchRating(opponent, seed, round);
}

function findLongestWinStreak(fixtures: MatchFixture[]): number {
  let best = 0;
  let current = 0;
  for (const fixture of fixtures) {
    if (fixture.result === "W") {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function findLongestLosingStreak(fixtures: MatchFixture[]): number {
  let best = 0;
  let current = 0;
  for (const fixture of fixtures) {
    if (fixture.result === "L") {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

export function createFantasySeasonState(
  squad: SquadSlot[],
  seed: string
): FantasySeasonState {
  const { schedule, replacedTeam } = buildSeasonSchedule(seed);
  return {
    seed,
    squad,
    schedule,
    replacedTeam,
    fixtures: [],
    currentRound: 0,
    matchSimState: { form: 0, seasonDropGoals: 0 },
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    gameResults: [],
    isComplete: false,
  };
}

function simulateRound(
  state: FantasySeasonState,
  roundIndex: number
): FantasySeasonState {
  const { opponent, isHome } = state.schedule[roundIndex];
  const round = roundIndex + 1;
  const opponentRating = getOpponentMatchRatingForFantasy(
    opponent,
    state.seed,
    round
  );

  const { fixture, state: nextSimState } = simulateOneFixture(
    state.squad,
    opponent,
    isHome,
    round,
    state.seed,
    state.matchSimState,
    { opponentRatingOverride: opponentRating }
  );

  enrichSingleFixtureScoring(state.squad, fixture, state.seed);
  enrichFantasyFixtureSummary(fixture, state.squad, state.seed);

  const won = fixture.result === "W";
  return {
    ...state,
    fixtures: [...state.fixtures, fixture],
    currentRound: round,
    matchSimState: nextSimState,
    wins: state.wins + (won ? 1 : 0),
    losses: state.losses + (won ? 0 : 1),
    pointsFor: state.pointsFor + fixture.pointsFor,
    pointsAgainst: state.pointsAgainst + fixture.pointsAgainst,
    gameResults: [...state.gameResults, fixture.result],
    isComplete: round >= SEASON_GAMES,
  };
}

export function simulateNextFantasyRound(
  state: FantasySeasonState
): FantasySeasonState {
  if (state.isComplete || state.currentRound >= SEASON_GAMES) return state;
  return simulateRound(state, state.currentRound);
}

export function simulateAllFantasyRounds(
  state: FantasySeasonState
): FantasySeasonState {
  let next = state;
  while (!next.isComplete && next.currentRound < SEASON_GAMES) {
    next = simulateNextFantasyRound(next);
  }
  return next;
}

export function buildFantasySeasonResult(
  state: FantasySeasonState
): SeasonResult {
  const strength = calculateSquadStrength(state.squad);
  const fixtures = [...state.fixtures];
  const tryScorers = distributeSeasonTries(
    state.squad,
    fixtures,
    state.seed,
    state.wins
  );

  const partial: SeasonResult = {
    wins: state.wins,
    losses: state.losses,
    pointsFor: state.pointsFor,
    pointsAgainst: state.pointsAgainst,
    pointsDifference: state.pointsFor - state.pointsAgainst,
    leaguePosition: 14,
    isPerfect: state.wins === SEASON_GAMES,
    longestWinStreak: findLongestWinStreak(fixtures),
    longestLosingStreak: findLongestLosingStreak(fixtures),
    gameResults: state.gameResults,
    fixtures,
    squadStrength: Math.round(strength * 10) / 10,
    tryScorers,
    insights: [],
    replacedTeam: state.replacedTeam,
  };

  partial.insights = generateSeasonInsights(partial);
  partial.leaguePosition = getDreamTeamTablePosition(partial, state.seed);
  return partial;
}

export function getPartialSeasonResult(
  state: FantasySeasonState
): SeasonResult {
  const strength = calculateSquadStrength(state.squad);
  const partial: SeasonResult = {
    wins: state.wins,
    losses: state.losses,
    pointsFor: state.pointsFor,
    pointsAgainst: state.pointsAgainst,
    pointsDifference: state.pointsFor - state.pointsAgainst,
    leaguePosition: 14,
    isPerfect: false,
    longestWinStreak: findLongestWinStreak(state.fixtures),
    longestLosingStreak: findLongestLosingStreak(state.fixtures),
    gameResults: state.gameResults,
    fixtures: state.fixtures,
    squadStrength: Math.round(strength * 10) / 10,
    tryScorers: [],
    insights: [],
    replacedTeam: state.replacedTeam,
  };

  if (state.fixtures.length > 0) {
    partial.leaguePosition = getDreamTeamTablePosition(partial, state.seed);
  }
  return partial;
}

export function formatFantasyRoundResult(
  fixture: MatchFixture
): string {
  const venue = fixture.isHome ? "vs" : "@";
  return `Round ${fixture.round} Dream Team ${fixture.pointsFor} - ${fixture.pointsAgainst} ${venue} ${fixture.opponent}`;
}

/** League teams for fantasy season table (14 teams). */
export function getFantasyLeagueTeams(seed: string): string[] {
  return getSeasonLeagueClubs(seed).leagueTeams;
}

export function getFantasyUserTeamRating(squad: SquadSlot[]): number {
  return Math.round(getAverageSquadRating(squad) * 10) / 10;
}
