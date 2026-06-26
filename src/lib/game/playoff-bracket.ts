import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";
import type { LeagueTableRow } from "./league-table";
import { buildOpponentScoringDetail } from "./opponent-scorers";
import {
  decomposeRLScore,
  pickRLScore,
  snapToRLScore,
  type ScoreBreakdown,
} from "./rl-scores";
import { getWinnerLoserScoreBounds } from "./score-gap";
import { enrichSingleFixtureScoring } from "./season-tries";
import {
  DREAM_TEAM_NAME,
  simulateOneFixture,
  type MatchFixture,
  type MatchSimState,
  type TeamScoringDetail,
} from "./season-simulation";
import {
  getGeneratedClubSquadStrength,
  type OpponentPoolOptions,
} from "./opponent-squad-strength";
import { distributeSeasonTries } from "./season-tries";
import type {
  PlayoffFinish,
  PlayoffResult,
  PlayoffRoundResult,
} from "./playoff-simulation";

export interface PlayoffBracketScoringDetail {
  home: TeamScoringDetail;
  away: TeamScoringDetail;
}

export interface PlayoffBracketMatch {
  id: string;
  round: 1 | 2 | 3;
  slot: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  loser: string | null;
  status: "pending" | "ready" | "complete";
  isNeutral: boolean;
  isUserMatch: boolean;
  feederIds: string[] | null;
  userFixture: MatchFixture | null;
  scoringDetail: PlayoffBracketScoringDetail | null;
}

export interface PlayoffBracketState {
  seed: string;
  leaguePosition: number;
  matches: PlayoffBracketMatch[];
  simState: MatchSimState;
  userEliminated: boolean;
  tournamentComplete: boolean;
  finish: PlayoffFinish | null;
  /** Current Mode — opponent squads use 2026 team-year rosters only. */
  currentSeasonOnly?: boolean;
}

function opponentPoolOptions(
  state: PlayoffBracketState
): OpponentPoolOptions | undefined {
  return state.currentSeasonOnly ? { currentSeasonOnly: true } : undefined;
}

function teamAtPosition(table: LeagueTableRow[], position: number): string {
  return table.find((row) => row.position === position)?.team ?? `Team ${position}`;
}

function isUserTeam(team: string | null): boolean {
  return team === DREAM_TEAM_NAME;
}

function createMatch(
  id: string,
  round: 1 | 2 | 3,
  slot: number,
  homeTeam: string | null,
  awayTeam: string | null,
  feederIds: string[] | null,
  isNeutral: boolean
): PlayoffBracketMatch {
  const ready = homeTeam !== null && awayTeam !== null;
  return {
    id,
    round,
    slot,
    homeTeam,
    awayTeam,
    homeScore: null,
    awayScore: null,
    winner: null,
    loser: null,
    status: ready ? "ready" : "pending",
    isNeutral,
    isUserMatch:
      isUserTeam(homeTeam) || isUserTeam(awayTeam),
    feederIds,
    userFixture: null,
    scoringDetail: null,
  };
}

export function createPlayoffBracket(
  seed: string,
  leagueTable: LeagueTableRow[],
  leaguePosition: number,
  options?: { currentSeasonOnly?: boolean }
): PlayoffBracketState {
  const first = teamAtPosition(leagueTable, 1);
  const second = teamAtPosition(leagueTable, 2);
  const third = teamAtPosition(leagueTable, 3);
  const fourth = teamAtPosition(leagueTable, 4);
  const fifth = teamAtPosition(leagueTable, 5);
  const sixth = teamAtPosition(leagueTable, 6);

  const matches: PlayoffBracketMatch[] = [
    createMatch("elim-low", 1, 0, third, sixth, null, false),
    createMatch("elim-high", 1, 1, fourth, fifth, null, false),
    createMatch("semi-low", 2, 0, first, null, ["elim-low"], false),
    createMatch("semi-high", 2, 1, second, null, ["elim-high"], false),
    createMatch("gf", 3, 0, null, null, ["semi-low", "semi-high"], true),
  ];

  return {
    seed,
    leaguePosition,
    matches,
    simState: { form: 0, seasonDropGoals: 0 },
    userEliminated: false,
    tournamentComplete: false,
    finish: null,
    currentSeasonOnly: options?.currentSeasonOnly ?? false,
  };
}

export function getPlayoffRoundLabel(round: number): string {
  switch (round) {
    case 1:
      return "Eliminator";
    case 2:
      return "Semi Final";
    case 3:
      return "Grand Final";
    default:
      return `Round ${round}`;
  }
}

export function getMatchById(
  state: PlayoffBracketState,
  id: string
): PlayoffBracketMatch | undefined {
  return state.matches.find((m) => m.id === id);
}

export function getMatchesForRound(
  state: PlayoffBracketState,
  round: number
): PlayoffBracketMatch[] {
  return state.matches.filter((m) => m.round === round);
}

export function getActiveRound(state: PlayoffBracketState): number {
  for (let r = 1; r <= 3; r++) {
    const roundMatches = getMatchesForRound(state, r);
    if (roundMatches.some((m) => m.status === "ready")) return r;
  }
  return 3;
}

export function canSimulatePlayoffMatch(
  state: PlayoffBracketState,
  matchId: string
): boolean {
  if (state.tournamentComplete) return false;
  const match = getMatchById(state, matchId);
  if (!match || match.status !== "ready") return false;
  if (state.userEliminated && match.isUserMatch) return false;
  return true;
}

function rebuildBracketFromWinners(matches: PlayoffBracketMatch[]): void {
  for (const child of matches) {
    if (!child.feederIds?.length || child.status === "complete") continue;

    const feederWinners = child.feederIds.map((feederId) => {
      const feeder = matches.find((m) => m.id === feederId);
      return feeder?.status === "complete" ? feeder.winner : null;
    });

    if (child.feederIds.length === 1) {
      child.awayTeam = feederWinners[0] ?? null;
    } else {
      child.homeTeam = feederWinners[0] ?? null;
      child.awayTeam = feederWinners[1] ?? null;
    }

    const ready = child.homeTeam !== null && child.awayTeam !== null;
    child.status = ready ? "ready" : "pending";
    if (ready) {
      child.isUserMatch =
        isUserTeam(child.homeTeam) || isUserTeam(child.awayTeam);
    }
  }
}

function getPlayoffTeamStrength(
  team: string,
  seed: string,
  matchId: string,
  rng: () => number,
  options?: OpponentPoolOptions
): number {
  if (team === DREAM_TEAM_NAME) return 80;
  return (
    getGeneratedClubSquadStrength(team, seed, "season", options ?? {}) +
    (rng() - 0.5) * 5
  );
}

function buildClubScoring(
  club: string,
  tries: number,
  scoring: ScoreBreakdown,
  seed: string,
  round: number,
  matchId: string,
  options?: OpponentPoolOptions
): TeamScoringDetail {
  const fakeFixture: MatchFixture = {
    round,
    opponent: club,
    isHome: true,
    pointsFor: 0,
    pointsAgainst: 0,
    triesFor: 0,
    triesAgainst: tries,
    scoringFor: {
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      points: 0,
    },
    scoringAgainst: scoring,
    result: "W",
  };
  return buildOpponentScoringDetail(fakeFixture, `${seed}-${matchId}`, options);
}

function simulateClubVsClub(
  home: string,
  away: string,
  seed: string,
  matchId: string,
  round: number,
  isNeutral: boolean,
  options?: OpponentPoolOptions
): {
  homeScore: number;
  awayScore: number;
  homeScoring: ScoreBreakdown;
  awayScoring: ScoreBreakdown;
  winner: string;
  loser: string;
} {
  const rng = seedrandom(`${seed}-playoff-ai-${matchId}`);
  const homeStr = getPlayoffTeamStrength(home, seed, matchId, rng, options);
  const awayStr = getPlayoffTeamStrength(away, seed, matchId, rng, options);
  const homeAdvantage = isNeutral ? 0 : 3;
  const homeWins =
    rng() < 0.5 + ((homeStr + homeAdvantage - awayStr) / 100) * 0.65;

  const winnerStrength = homeWins ? homeStr + homeAdvantage : awayStr;
  const loserStrength = homeWins ? awayStr : homeStr + homeAdvantage;
  const ratingGap = Math.abs(winnerStrength - loserStrength);
  const bounds = getWinnerLoserScoreBounds(ratingGap, rng);
  const winScore = pickRLScore(bounds.winnerMin, bounds.winnerMax, rng);
  const lossScore = pickRLScore(bounds.loserMin, bounds.loserMax, rng);
  let homeScore = snapToRLScore(homeWins ? winScore : lossScore);
  let awayScore = snapToRLScore(homeWins ? lossScore : winScore);
  if (homeScore === awayScore) {
    if (homeWins) homeScore = snapToRLScore(homeScore + 2);
    else awayScore = snapToRLScore(awayScore + 2);
  }
  const homeScoring = decomposeRLScore(homeScore);
  const awayScoring = decomposeRLScore(awayScore);

  return {
    homeScore,
    awayScore,
    homeScoring,
    awayScoring,
    winner: homeWins ? home : away,
    loser: homeWins ? away : home,
  };
}

function completeMatch(
  match: PlayoffBracketMatch,
  homeScore: number,
  awayScore: number,
  winner: string,
  loser: string,
  scoringDetail: PlayoffBracketScoringDetail | null,
  userFixture: MatchFixture | null
): void {
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.winner = winner;
  match.loser = loser;
  match.status = "complete";
  match.scoringDetail = scoringDetail;
  match.userFixture = userFixture;
}

function resolveFinish(
  state: PlayoffBracketState,
  lastUserMatch: PlayoffBracketMatch,
  userWon: boolean
): PlayoffFinish {
  if (!userWon) {
    if (lastUserMatch.round === 1) return "Eliminated in Eliminator";
    if (lastUserMatch.round === 2) return "Eliminated in Semi-Final";
    return "Grand Final Runner-Up";
  }
  if (lastUserMatch.round === 3) return "Super League Champions";
  return state.finish ?? "Super League Champions";
}

function syncAfterMatch(
  state: PlayoffBracketState,
  match: PlayoffBracketMatch,
  userWon: boolean | null
): PlayoffBracketState {
  const matches = state.matches.map((m) => ({ ...m }));
  rebuildBracketFromWinners(matches);

  let userEliminated = state.userEliminated;
  let tournamentComplete = state.tournamentComplete;
  let finish = state.finish;

  if (match.isUserMatch && userWon === false) {
    userEliminated = true;
    finish = resolveFinish({ ...state, finish }, match, false);
  } else if (match.isUserMatch && userWon === true && match.round === 3) {
    tournamentComplete = true;
    finish = "Super League Champions";
  } else if (match.isUserMatch && userWon === true && match.round < 3) {
    const gf = matches.find((m) => m.id === "gf");
    if (gf?.status === "ready" && gf.isUserMatch) {
      // user won semi, GF ready — not complete yet
    }
  }

  const gf = matches.find((m) => m.id === "gf");
  if (gf?.status === "complete") {
    tournamentComplete = true;
    if (!finish && gf.winner !== DREAM_TEAM_NAME) {
      finish = state.finish ?? "Grand Final Runner-Up";
    }
  }

  return {
    ...state,
    matches,
    userEliminated,
    tournamentComplete,
    finish,
  };
}

function simulateUserMatch(
  state: PlayoffBracketState,
  match: PlayoffBracketMatch,
  squad: SquadSlot[]
): PlayoffBracketState {
  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const isHome = home === DREAM_TEAM_NAME;
  const opponent = isHome ? away : home;
  const poolOptions = opponentPoolOptions(state);
  const opponentStrength = getGeneratedClubSquadStrength(
    opponent,
    state.seed,
    "season",
    poolOptions ?? {}
  );

  const { fixture, state: nextSim } = simulateOneFixture(
    squad,
    opponent,
    match.isNeutral ? false : isHome,
    28 + match.round,
    `${state.seed}-playoff-${match.id}`,
    state.simState,
    {
      cupMode: true,
      opponentRatingOverride: opponentStrength + (isHome ? 0 : 3),
      draftMode: false,
      ...(poolOptions ?? {}),
    }
  );

  enrichSingleFixtureScoring(squad, fixture, state.seed, poolOptions);

  const homeScore = isHome ? fixture.pointsFor : fixture.pointsAgainst;
  const awayScore = isHome ? fixture.pointsAgainst : fixture.pointsFor;
  const userWon = fixture.result === "W";
  const winner = userWon ? DREAM_TEAM_NAME : opponent;
  const loser = userWon ? opponent : DREAM_TEAM_NAME;

  const detail = fixture.scoringDetail!;
  const scoringDetail: PlayoffBracketScoringDetail = {
    home: isHome ? detail.dreamTeam : detail.opponent,
    away: isHome ? detail.opponent : detail.dreamTeam,
  };

  const userFixture: MatchFixture = {
    ...fixture,
    opponent,
    isHome: match.isNeutral ? false : isHome,
    isNeutral: match.isNeutral,
    result: userWon ? "W" : "L",
  };

  const matches = state.matches.map((m) => ({ ...m }));
  const m = matches.find((x) => x.id === match.id)!;
  completeMatch(m, homeScore, awayScore, winner, loser, scoringDetail, userFixture);

  const synced = syncAfterMatch(
    { ...state, matches, simState: nextSim },
    m,
    userWon
  );

  if (userWon && match.round === 3) {
    return { ...synced, tournamentComplete: true, finish: "Super League Champions" };
  }

  if (!userWon) {
    return simulateRemainingPlayoffBracket(synced, squad);
  }

  const gf = synced.matches.find((x) => x.id === "gf");
  if (gf?.status === "complete" && gf.isUserMatch) {
    const gfWon = gf.winner === DREAM_TEAM_NAME;
    return {
      ...synced,
      tournamentComplete: true,
      finish: gfWon ? "Super League Champions" : "Grand Final Runner-Up",
    };
  }

  return synced;
}

function simulateAiMatch(
  state: PlayoffBracketState,
  match: PlayoffBracketMatch
): PlayoffBracketState {
  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const poolOptions = opponentPoolOptions(state);
  const result = simulateClubVsClub(
    home,
    away,
    state.seed,
    match.id,
    match.round,
    match.isNeutral,
    poolOptions
  );

  const scoringDetail: PlayoffBracketScoringDetail = {
    home: buildClubScoring(
      home,
      result.homeScoring.tries,
      result.homeScoring,
      state.seed,
      match.round,
      match.id,
      poolOptions
    ),
    away: buildClubScoring(
      away,
      result.awayScoring.tries,
      result.awayScoring,
      state.seed,
      match.round,
      match.id,
      poolOptions
    ),
  };

  const matches = state.matches.map((m) => ({ ...m }));
  const m = matches.find((x) => x.id === match.id)!;
  completeMatch(
    m,
    result.homeScore,
    result.awayScore,
    result.winner,
    result.loser,
    scoringDetail,
    null
  );

  return syncAfterMatch({ ...state, matches }, m, null);
}

function runMatch(
  state: PlayoffBracketState,
  matchId: string,
  squad: SquadSlot[]
): PlayoffBracketState {
  const match = getMatchById(state, matchId);
  if (!match || match.status !== "ready") return state;
  if (match.isUserMatch) return simulateUserMatch(state, match, squad);
  return simulateAiMatch(state, match);
}

export function simulatePlayoffBracketMatch(
  state: PlayoffBracketState,
  matchId: string,
  squad: SquadSlot[]
): PlayoffBracketState {
  if (!canSimulatePlayoffMatch(state, matchId)) return state;
  return runMatch(state, matchId, squad);
}

export function simulateRemainingPlayoffBracket(
  state: PlayoffBracketState,
  squad: SquadSlot[]
): PlayoffBracketState {
  let next = state;
  const maxSteps = 12;

  for (let step = 0; step < maxSteps; step++) {
    if (next.tournamentComplete) break;

    const ready = next.matches.filter((m) => m.status === "ready");
    if (ready.length === 0) break;

    const match =
      ready.find((m) => !m.isUserMatch) ??
      (next.userEliminated ? null : ready.find((m) => m.isUserMatch));

    if (!match) break;
    next = runMatch(next, match.id, squad);
  }

  return next;
}

export function simulatePlayoffBracketRound(
  state: PlayoffBracketState,
  round: number,
  squad: SquadSlot[]
): PlayoffBracketState {
  let next = state;
  const roundMatches = getMatchesForRound(next, round).filter(
    (m) => m.status === "ready"
  );
  for (const match of roundMatches) {
    if (next.tournamentComplete) break;
    if (next.userEliminated && match.isUserMatch) continue;
    next = runMatch(next, match.id, squad);
  }
  return next;
}

export function simulatePlayoffBracketTournament(
  state: PlayoffBracketState,
  squad: SquadSlot[]
): PlayoffBracketState {
  let next = state;
  for (let round = 1; round <= 3; round++) {
    if (next.tournamentComplete) break;
    next = simulatePlayoffBracketRound(next, round, squad);
  }
  return next;
}

function matchToRoundResult(match: PlayoffBracketMatch): PlayoffRoundResult {
  const roundName =
    match.round === 1
      ? "Eliminator"
      : match.round === 2
        ? "Semi Final"
        : "Grand Final";

  const userPlayed = match.isUserMatch;
  const userWon = userPlayed
    ? match.winner === DREAM_TEAM_NAME
    : null;

  const backgroundFixtures = match.userFixture ? [] : [];

  return {
    round: roundName,
    roundIndex: match.round,
    opponent:
      match.isUserMatch && match.userFixture
        ? match.userFixture.opponent
        : "",
    isHome: match.userFixture?.isHome ?? false,
    isNeutral: match.isNeutral,
    userPlayed,
    userWon,
    fixture:
      match.userFixture ??
      ({
        round: 28 + match.round,
        opponent: match.awayTeam ?? "",
        isHome: true,
        pointsFor: match.homeScore ?? 0,
        pointsAgainst: match.awayScore ?? 0,
        triesFor: 0,
        triesAgainst: 0,
        scoringFor: decomposeRLScore(match.homeScore ?? 0),
        scoringAgainst: decomposeRLScore(match.awayScore ?? 0),
        result: "W",
      } satisfies MatchFixture),
    backgroundFixtures,
  };
}

export function buildPlayoffResult(
  state: PlayoffBracketState,
  squad: SquadSlot[]
): PlayoffResult {
  const userMatches = state.matches
    .filter((m) => m.isUserMatch && m.status === "complete" && m.userFixture)
    .sort((a, b) => a.round - b.round);

  const userFixtures = userMatches.map((m) => m.userFixture!);
  const wins = userFixtures.filter((f) => f.result === "W").length;
  const losses = userFixtures.filter((f) => f.result === "L").length;

  let finish: PlayoffFinish = state.finish ?? "Super League Champions";
  if (state.userEliminated && userMatches.length > 0) {
    const last = userMatches[userMatches.length - 1];
    finish = resolveFinish(state, last, last.winner === DREAM_TEAM_NAME);
  } else if (userMatches.some((m) => m.round === 3)) {
    const gf = userMatches.find((m) => m.round === 3)!;
    finish =
      gf.winner === DREAM_TEAM_NAME
        ? "Super League Champions"
        : "Grand Final Runner-Up";
  }

  const rounds = userMatches.map(matchToRoundResult);

  const tryScorers =
    userFixtures.length > 0
      ? distributeSeasonTries(
          squad,
          userFixtures,
          state.seed,
          wins,
          opponentPoolOptions(state)
        )
      : [];

  return {
    qualified: true,
    finish,
    leaguePosition: state.leaguePosition,
    rounds,
    userFixtures,
    wins,
    losses,
    isChampion: finish === "Super League Champions",
    tryScorers,
  };
}

/** Build a bracket match view from a stored playoff round (review page). */
export function playoffRoundResultToBracketMatch(
  round: PlayoffRoundResult,
  id: string
): PlayoffBracketMatch | null {
  if (!round.userPlayed) return null;

  const f = round.fixture;
  const homeTeam = f.isHome ? DREAM_TEAM_NAME : round.opponent;
  const awayTeam = f.isHome ? round.opponent : DREAM_TEAM_NAME;
  const homeScore = f.isHome ? f.pointsFor : f.pointsAgainst;
  const awayScore = f.isHome ? f.pointsAgainst : f.pointsFor;
  const userWon = f.result === "W";
  const winner = userWon ? DREAM_TEAM_NAME : round.opponent;
  const loser = userWon ? round.opponent : DREAM_TEAM_NAME;

  const sd = f.scoringDetail;
  const scoringDetail: PlayoffBracketScoringDetail | null = sd
    ? {
        home: f.isHome ? sd.dreamTeam : sd.opponent,
        away: f.isHome ? sd.opponent : sd.dreamTeam,
      }
    : null;

  return {
    id,
    round: round.roundIndex as 1 | 2 | 3,
    slot: 0,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winner,
    loser,
    status: "complete",
    isNeutral: round.isNeutral,
    isUserMatch: true,
    feederIds: null,
    userFixture: f,
    scoringDetail,
  };
}
