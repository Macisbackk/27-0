import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";
import { getActiveSuperLeagueClubNames } from "../clubs/super-league-display";
import { buildOpponentScoringDetail } from "./opponent-scorers";
import {
  decomposeRLScore,
  pickRLScore,
  snapToRLScore,
} from "./rl-scores";
import {
  buildChallengeCupTournamentStats,
  deriveCupTryScorersFromMatchEvents,
} from "./challenge-cup-stats";
import { enrichSingleFixtureScoring } from "./season-tries";
import type {
  ChallengeCupResult,
  CupFinish,
  CupRoundName,
} from "./challenge-cup-simulation";
import { CUP_ROUND_NAMES } from "./challenge-cup-simulation";
import {
  calculateSquadStrength,
  simulateOneFixture,
  type MatchFixture,
  type MatchSimState,
  type TeamScoringDetail,
} from "./season-simulation";
import type { ScoreBreakdown } from "./rl-scores";

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

export interface BracketScoringDetail {
  home: TeamScoringDetail;
  away: TeamScoringDetail;
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  loser: string | null;
  status: "pending" | "ready" | "complete";
  isUserMatch: boolean;
  feederIds: string[] | null;
  userFixture: MatchFixture | null;
  scoringDetail: BracketScoringDetail | null;
  matchEvents: string[] | null;
}

export interface ChallengeCupBracketState {
  seed: string;
  userClub: string;
  /** Two clubs randomly seeded directly into the quarter-finals. */
  byeTeams: [string, string];
  matches: BracketMatch[];
  simState: MatchSimState;
  userEliminated: boolean;
  tournamentComplete: boolean;
  userWon: boolean;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getClubStrength(club: string, rng: () => number): number {
  const base = CLUB_STRENGTH[club] ?? 70;
  return base + (rng() - 0.5) * 8;
}

/** Pick two distinct clubs for quarter-final byes — equal chance for every active club. */
function pickByeTeams(
  allClubs: string[],
  seed: string
): [string, string] {
  const rng = seedrandom(`${seed}-byes`);
  const shuffled = shuffle([...allClubs], rng);
  return [shuffled[0], shuffled[1]];
}

function isUserTeam(team: string | null, userClub: string): boolean {
  return team === userClub;
}

function createMatch(
  id: string,
  round: number,
  slot: number,
  homeTeam: string | null,
  awayTeam: string | null,
  feederIds: string[] | null,
  userClub: string
): BracketMatch {
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
    isUserMatch:
      isUserTeam(homeTeam, userClub) || isUserTeam(awayTeam, userClub),
    feederIds,
    userFixture: null,
    scoringDetail: null,
    matchEvents: null,
  };
}

export function createChallengeCupBracket(
  seed: string,
  userClub: string
): ChallengeCupBracketState {
  const allClubs = getActiveSuperLeagueClubNames();
  const byeTeams = pickByeTeams(allClubs, seed);
  const byeSet = new Set(byeTeams);
  const r16Rng = seedrandom(`${seed}-r16`);
  const r16Teams = shuffle(
    allClubs.filter((c) => !byeSet.has(c)),
    r16Rng
  );
  const matches: BracketMatch[] = [];

  for (let i = 0; i < 6; i++) {
    matches.push(
      createMatch(
        `1-${i}`,
        1,
        i,
        r16Teams[i * 2],
        r16Teams[i * 2 + 1],
        null,
        userClub
      )
    );
  }

  matches.push(
    createMatch("2-0", 2, 0, null, null, ["1-0", "1-1"], userClub),
    createMatch("2-1", 2, 1, null, null, ["1-2", "1-3"], userClub),
    createMatch("2-2", 2, 2, byeTeams[0], null, ["1-4"], userClub),
    createMatch("2-3", 2, 3, byeTeams[1], null, ["1-5"], userClub)
  );

  for (let i = 0; i < 2; i++) {
    matches.push(
      createMatch(
        `3-${i}`,
        3,
        i,
        null,
        null,
        [`2-${i * 2}`, `2-${i * 2 + 1}`],
        userClub
      )
    );
  }
  matches.push(
    createMatch("4-0", 4, 0, null, null, ["3-0", "3-1"], userClub)
  );

  return {
    seed,
    userClub,
    byeTeams,
    matches,
    simState: { form: 0, seasonDropGoals: 0 },
    userEliminated: false,
    tournamentComplete: false,
    userWon: false,
  };
}

export function getMatchById(
  state: ChallengeCupBracketState,
  id: string
): BracketMatch | undefined {
  return state.matches.find((m) => m.id === id);
}

export function getMatchesForRound(
  state: ChallengeCupBracketState,
  round: number
): BracketMatch[] {
  return state.matches.filter((m) => m.round === round);
}

export function getActiveRound(state: ChallengeCupBracketState): number {
  for (let r = 1; r <= 4; r++) {
    const roundMatches = getMatchesForRound(state, r);
    if (roundMatches.some((m) => m.status === "ready")) return r;
  }
  return 4;
}

export function canSimulateMatch(
  state: ChallengeCupBracketState,
  matchId: string
): boolean {
  if (state.userEliminated || state.tournamentComplete) return false;
  const match = getMatchById(state, matchId);
  return match?.status === "ready";
}

function buildClubScoring(
  club: string,
  tries: number,
  scoring: ScoreBreakdown,
  seed: string,
  round: number,
  matchId: string
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
  return buildOpponentScoringDetail(
    fakeFixture,
    `${seed}-${matchId}`
  );
}

function simulateClubVsClub(
  home: string,
  away: string,
  seed: string,
  matchId: string,
  round: number
): {
  homeScore: number;
  awayScore: number;
  homeScoring: ScoreBreakdown;
  awayScoring: ScoreBreakdown;
  winner: string;
  loser: string;
} {
  const rng = seedrandom(`${seed}-ai-${matchId}`);
  const homeStr = getClubStrength(home, rng);
  const awayStr = getClubStrength(away, rng);
  const homeAdvantage = 3;
  const homeWins =
    rng() <
    0.5 + ((homeStr + homeAdvantage - awayStr) / 100) * 0.65;

  const winScore = pickRLScore(14, 38, rng);
  const lossScore = pickRLScore(0, 26, rng);
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

/** Rebuild child fixtures from feeder winners only — never infer from slot order. */
function rebuildBracketFromWinners(
  matches: BracketMatch[],
  userClub: string
): void {
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

    const ready =
      child.homeTeam !== null && child.awayTeam !== null;
    child.status = ready ? "ready" : "pending";
    if (ready) {
      child.isUserMatch =
        isUserTeam(child.homeTeam, userClub) ||
        isUserTeam(child.awayTeam, userClub);
    }
  }
}

function validateBracket(matches: BracketMatch[]): boolean {
  let valid = true;

  for (const match of matches) {
    if (match.status !== "complete") continue;

    if (
      !match.winner ||
      (match.winner !== match.homeTeam && match.winner !== match.awayTeam)
    ) {
      console.error(
        `[bracket] ${match.id}: invalid winner "${match.winner}" (${match.homeTeam} vs ${match.awayTeam})`
      );
      valid = false;
    }

    if (match.loser && match.loser === match.winner) {
      console.error(
        `[bracket] ${match.id}: loser equals winner "${match.winner}"`
      );
      valid = false;
    }
  }

  for (const child of matches) {
    if (!child.feederIds?.length) continue;

    for (const feederId of child.feederIds) {
      const feeder = matches.find((m) => m.id === feederId);
      if (feeder?.status !== "complete" || !feeder.loser) continue;

      if (
        child.homeTeam === feeder.loser ||
        child.awayTeam === feeder.loser
      ) {
        console.error(
          `[bracket] Loser "${feeder.loser}" from ${feederId} incorrectly placed in ${child.id}`
        );
        valid = false;
      }
    }

    const feederWinners = child.feederIds
      .map((id) => matches.find((m) => m.id === id))
      .filter((f): f is BracketMatch => f?.status === "complete")
      .map((f) => f.winner)
      .filter((w): w is string => w !== null);

    for (const winner of feederWinners) {
      if (
        child.status !== "complete" &&
        child.homeTeam !== winner &&
        child.awayTeam !== winner
      ) {
        console.error(
          `[bracket] Winner "${winner}" from feeder missing in ${child.id}`
        );
        valid = false;
      }
    }
  }

  const final = matches.find((m) => m.id === "4-0");
  if (final?.status === "complete" && final.winner) {
    if (final.winner !== final.homeTeam && final.winner !== final.awayTeam) {
      console.error(`[bracket] Final winner "${final.winner}" is invalid`);
      valid = false;
    }
  }

  return valid;
}

function syncBracketAfterMatch(
  matches: BracketMatch[],
  userClub: string
): void {
  rebuildBracketFromWinners(matches, userClub);
  if (!validateBracket(matches)) {
    console.error("[bracket] Validation failed — rebuilding from winners");
    rebuildBracketFromWinners(matches, userClub);
    validateBracket(matches);
  }
}

function completeMatch(
  match: BracketMatch,
  homeScore: number,
  awayScore: number,
  winner: string,
  loser: string,
  scoringDetail: BracketScoringDetail | null,
  userFixture: MatchFixture | null
): void {
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.winner = winner;
  match.loser = loser;
  match.status = "complete";
  match.scoringDetail = scoringDetail;
  match.userFixture = userFixture;
  match.matchEvents = [
    `${winner} def. ${loser} ${homeScore}-${awayScore}`,
  ];
}

function simulateUserMatch(
  state: ChallengeCupBracketState,
  match: BracketMatch,
  squad: SquadSlot[]
): ChallengeCupBracketState {
  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const userClub = state.userClub;
  const isHome = home === userClub;
  const opponent = isHome ? away : home;

  const { fixture, state: nextSim } = simulateOneFixture(
    squad,
    opponent,
    isHome,
    match.round,
    `${state.seed}-cup-${match.id}`,
    state.simState,
    { cupMode: true }
  );

  enrichSingleFixtureScoring(squad, fixture, state.seed);

  const homeScore = isHome ? fixture.pointsFor : fixture.pointsAgainst;
  const awayScore = isHome ? fixture.pointsAgainst : fixture.pointsFor;
  const winner = fixture.result === "W" ? userClub : opponent;
  const loser = fixture.result === "W" ? opponent : userClub;

  const detail = fixture.scoringDetail!;
  const scoringDetail: BracketScoringDetail = {
    home: isHome ? detail.dreamTeam : detail.opponent,
    away: isHome ? detail.opponent : detail.dreamTeam,
  };

  const matches = state.matches.map((m) => ({ ...m }));
  const m = matches.find((x) => x.id === match.id)!;
  completeMatch(m, homeScore, awayScore, winner, loser, scoringDetail, fixture);
  syncBracketAfterMatch(matches, state.userClub);

  const userLost = fixture.result === "L";
  const userWonFinal =
    match.round === 4 && fixture.result === "W";
  const tournamentComplete = userLost || userWonFinal;

  return {
    ...state,
    matches,
    simState: nextSim,
    userEliminated: userLost,
    tournamentComplete,
    userWon: userWonFinal,
  };
}

function simulateAiMatch(
  state: ChallengeCupBracketState,
  match: BracketMatch
): ChallengeCupBracketState {
  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const result = simulateClubVsClub(
    home,
    away,
    state.seed,
    match.id,
    match.round
  );

  const scoringDetail: BracketScoringDetail = {
    home: buildClubScoring(
      home,
      result.homeScoring.tries,
      result.homeScoring,
      state.seed,
      match.round,
      match.id
    ),
    away: buildClubScoring(
      away,
      result.awayScoring.tries,
      result.awayScoring,
      state.seed,
      match.round,
      match.id
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
  syncBracketAfterMatch(matches, state.userClub);

  return { ...state, matches };
}

function runMatch(
  state: ChallengeCupBracketState,
  matchId: string,
  squad: SquadSlot[]
): ChallengeCupBracketState {
  const match = getMatchById(state, matchId);
  if (!match || match.status !== "ready") return state;

  if (match.isUserMatch) {
    return simulateUserMatch(state, match, squad);
  }
  return simulateAiMatch(state, match);
}

export function simulateBracketMatch(
  state: ChallengeCupBracketState,
  matchId: string,
  squad: SquadSlot[]
): ChallengeCupBracketState {
  if (!canSimulateMatch(state, matchId)) return state;
  return runMatch(state, matchId, squad);
}

export function simulateBracketRound(
  state: ChallengeCupBracketState,
  round: number,
  squad: SquadSlot[]
): ChallengeCupBracketState {
  let next = state;
  const roundMatches = getMatchesForRound(next, round).filter(
    (m) => m.status === "ready"
  );

  for (const match of roundMatches) {
    if (next.userEliminated || next.tournamentComplete) break;
    next = runMatch(next, match.id, squad);
  }

  const matches = next.matches.map((m) => ({ ...m }));
  syncBracketAfterMatch(matches, next.userClub);
  return { ...next, matches };
}

export function simulateBracketTournament(
  state: ChallengeCupBracketState,
  squad: SquadSlot[]
): ChallengeCupBracketState {
  let next = state;
  for (let round = 1; round <= 4; round++) {
    if (next.tournamentComplete) break;
    next = simulateBracketRound(next, round, squad);
  }
  return next;
}

function deriveFinishFromEliminationRound(
  eliminatedRound: number
): { finish: CupFinish; label: string } {
  if (eliminatedRound === 4) {
    return { finish: "Runners-Up", label: "Final Defeat" };
  }
  if (eliminatedRound === 3) {
    return { finish: "Semi Final", label: "Semi Final Exit" };
  }
  if (eliminatedRound === 2) {
    return { finish: "Quarter Final", label: "Quarter Final Exit" };
  }
  return { finish: "Round of 16", label: "Round of 16 Exit" };
}

export function getBracketFinalWinner(
  matches: BracketMatch[]
): string | null {
  const final = matches.find((m) => m.id === "4-0" && m.status === "complete");
  return final?.winner ?? null;
}

export function getUserEliminatedRound(
  state: ChallengeCupBracketState
): number | null {
  const userLoss = state.matches
    .filter((m) => m.isUserMatch && m.status === "complete")
    .sort((a, b) => a.round - b.round)
    .find((m) => m.userFixture?.result === "L");
  return userLoss?.round ?? null;
}

/** Single source of truth: bracket final winner + user elimination round. */
export function deriveCupOutcomeFromBracket(
  state: ChallengeCupBracketState
): { finish: CupFinish; label: string; isWinner: boolean } {
  const userTeam = state.userClub;
  const finalWinner = getBracketFinalWinner(state.matches);

  if (finalWinner === userTeam) {
    return {
      finish: "Winners",
      label: "Challenge Cup Winners",
      isWinner: true,
    };
  }

  const eliminatedRound = getUserEliminatedRound(state);
  if (eliminatedRound !== null) {
    const { finish, label } = deriveFinishFromEliminationRound(eliminatedRound);
    return { finish, label, isWinner: false };
  }

  return { finish: "Round of 16", label: "Round of 16 Exit", isWinner: false };
}

function deriveFinish(
  _userFixtures: MatchFixture[],
  state: ChallengeCupBracketState
): { finish: CupFinish; label: string; isWinner: boolean } {
  return deriveCupOutcomeFromBracket(state);
}

/** Simulate remaining AI fixtures so the bracket recap is fully populated. */
export function finalizeBracketDisplay(
  state: ChallengeCupBracketState
): ChallengeCupBracketState {
  let next = state;
  for (let round = 1; round <= 4; round++) {
    let progress = true;
    while (progress) {
      progress = false;
      const ready = next.matches.filter(
        (m) =>
          m.round === round &&
          m.status === "ready" &&
          !m.isUserMatch
      );
      for (const match of ready) {
        next = simulateAiMatch(next, match);
        progress = true;
      }
    }
  }
  return next;
}

export function buildChallengeCupResult(
  state: ChallengeCupBracketState,
  squad: SquadSlot[]
): ChallengeCupResult {
  const finalized = finalizeBracketDisplay(state);
  const userMatches = finalized.matches
    .filter((m) => m.isUserMatch && m.status === "complete")
    .sort((a, b) => a.round - b.round);

  const fixtures: MatchFixture[] = userMatches
    .map((m) => m.userFixture)
    .filter((f): f is MatchFixture => f !== null);

  const tournamentStats = buildChallengeCupTournamentStats(fixtures);
  const { wins, losses, pointsFor, pointsAgainst, matchesPlayed } =
    tournamentStats;
  const strength = calculateSquadStrength(squad);
  const outcome = deriveFinish(fixtures, finalized);
  const tryScorers = deriveCupTryScorersFromMatchEvents(
    squad,
    fixtures,
    state.seed,
    wins
  );

  return {
    finish: outcome.finish,
    resultLabel: outcome.label,
    matchesPlayed,
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    fixtures,
    tryScorers,
    tournamentStats,
    squadStrength: Math.round(strength * 10) / 10,
    insights: [],
    isWinner: outcome.isWinner,
    userClub: state.userClub,
    byeTeams: state.byeTeams,
    bracketMatches: finalized.matches,
  };
}

export function getCupRoundLabel(round: number): CupRoundName {
  return CUP_ROUND_NAMES[round - 1] ?? "Final";
}

export function bracketMatchToDisplayFixture(match: BracketMatch): {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoringDetail: BracketScoringDetail | null;
  userFixture: MatchFixture | null;
  round: number;
  roundLabel: string;
} | null {
  if (match.status !== "complete") return null;
  if (!match.homeTeam || !match.awayTeam) return null;
  if (match.homeScore === null || match.awayScore === null) return null;

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    scoringDetail: match.scoringDetail,
    userFixture: match.userFixture,
    round: match.round,
    roundLabel: getCupRoundLabel(match.round),
  };
}
