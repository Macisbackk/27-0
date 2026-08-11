import type { MatchFixture } from "../game/season-simulation";
import {
  getMatchById,
  simulatePlayoffBracketMatch,
  type PlayoffBracketMatch,
  type PlayoffBracketState,
} from "../game/playoff-bracket";
import { buildSquadSlotsFromMatchday } from "./managerSquad";
import { countCupFixturesPlayed, countLeagueFixturesPlayed, isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import { getManagerLeagueTable, getUserLeaguePosition } from "./managerFixtures";
import type { ManagerCareer, ManagerScheduledFixture } from "./types";
import { userWonMustHaveWinnerFixture } from "./matchResolutionRules";
import { isUserInChampionship } from "./leagueMembership";

export const CHAMPIONSHIP_PLAYOFF_FROM = 2;
export const CHAMPIONSHIP_PLAYOFF_TO = 5;

function tableFor(career: ManagerCareer) {
  return isUserInChampionship(career)
    ? getManagerLeagueTable(career)
    : (career.championshipCompetition?.standings ?? []);
}

function teamAt(career: ManagerCareer, position: number): string {
  return tableFor(career).find((row) => row.position === position)?.team ?? `Team ${position}`;
}

function match(
  id: string, round: 1 | 2 | 3, slot: number, home: string | null, away: string | null,
  feederIds: string[] | null, neutral: boolean, user: string
): PlayoffBracketMatch {
  const ready = !!home && !!away;
  return { id, round, slot, homeTeam: home, awayTeam: away, homeScore: null, awayScore: null,
    winner: null, loser: null, status: ready ? "ready" : "pending", isNeutral: neutral,
    isUserMatch: home === user || away === user, feederIds, userFixture: null, scoringDetail: null };
}

export function userQualifiedForChampionshipPlayoffs(career: ManagerCareer): boolean {
  if (!isUserInChampionship(career)) return false;
  const position = getUserLeaguePosition(getManagerLeagueTable(career), career.club);
  return position >= CHAMPIONSHIP_PLAYOFF_FROM && position <= CHAMPIONSHIP_PLAYOFF_TO;
}

export function createChampionshipPlayoffs(career: ManagerCareer): PlayoffBracketState {
  const userClub = career.club;
  return {
    seed: `${career.seed}-championship-playoffs`,
    leaguePosition: getUserLeaguePosition(getManagerLeagueTable(career), userClub),
    matches: [
      match("champ-semi-1", 1, 0, teamAt(career, 2), teamAt(career, 5), null, false, userClub),
      match("champ-semi-2", 1, 1, teamAt(career, 3), teamAt(career, 4), null, false, userClub),
      match("gf", 3, 0, null, null, ["champ-semi-1", "champ-semi-2"], true, userClub),
    ],
    simState: { form: 0, seasonDropGoals: 0 },
    userEliminated: false,
    tournamentComplete: false,
    finish: null,
    userClub,
    currentSeasonOnly: true,
  };
}

function squad(career: ManagerCareer) {
  return buildSquadSlotsFromMatchday(career.matchdayXiii, career.xiiiSlotPositions, career);
}

function simulateAi(bracket: PlayoffBracketState, career: ManagerCareer): PlayoffBracketState {
  let next = bracket;
  for (let i = 0; i < 16 && !next.tournamentComplete; i++) {
    const userReady = next.matches.find((m) => m.status === "ready" && m.isUserMatch);
    if (userReady && !next.userEliminated) break;
    const ready = next.matches.find((m) => m.status === "ready" && !m.isUserMatch);
    if (!ready) break;
    next = simulatePlayoffBracketMatch(next, ready.id, squad(career));
  }
  return next;
}

export function prepareChampionshipPlayoffRound(career: ManagerCareer): PlayoffBracketState {
  const bracket = career.championshipPlayoffs ?? createChampionshipPlayoffs(career);
  return simulateAi(bracket, career);
}

export function getUserChampionshipPlayoffMatch(bracket: PlayoffBracketState) {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;
  const match = bracket.matches.find((m) => m.status === "ready" && m.isUserMatch);
  if (!match?.homeTeam || !match.awayTeam) return null;
  const isHome = match.homeTeam === bracket.userClub;
  return { matchId: match.id, opponent: isHome ? match.awayTeam : match.homeTeam, isHome: match.isNeutral ? false : isHome,
    isNeutral: match.isNeutral, round: match.round, bracketHome: match.homeTeam, bracketAway: match.awayTeam };
}

export function buildChampionshipPlayoffScheduledFixture(career: ManagerCareer, playoffMatch: NonNullable<ReturnType<typeof getUserChampionshipPlayoffMatch>>): ManagerScheduledFixture {
  const isFinal = playoffMatch.matchId === "gf";
  return {
    id: `championship-playoff-${playoffMatch.matchId}`,
    round: countLeagueFixturesPlayed(career) + countCupFixturesPlayed(career) + playoffMatch.round,
    opponent: playoffMatch.opponent, isHome: playoffMatch.isHome, isNeutral: playoffMatch.isNeutral,
    competition: "championship_playoffs", playoffMatchId: playoffMatch.matchId, playoffRound: playoffMatch.round,
    listedHome: playoffMatch.bracketHome, listedAway: playoffMatch.bracketAway,
    label: isFinal ? "Championship Playoff Final" : "Championship Semi Final",
  };
}

export function isChampionshipPlayoffMatchReadyForResult(career: ManagerCareer, matchId: string): boolean {
  const m = career.championshipPlayoffs && getMatchById(career.championshipPlayoffs, matchId);
  return !!(m?.status === "ready" && m.homeTeam && m.awayTeam);
}

export function applyChampionshipPlayoffMatch(career: ManagerCareer, matchId: string, fixture: MatchFixture): PlayoffBracketState | null {
  const bracket = career.championshipPlayoffs;
  const m = bracket && getMatchById(bracket, matchId);
  if (!bracket || !m || m.status !== "ready" || !m.homeTeam || !m.awayTeam) return null;
  const user = career.club, isHome = m.homeTeam === user, opponent = isHome ? m.awayTeam : m.homeTeam;
  const userWon = userWonMustHaveWinnerFixture(fixture);
  const matches = bracket.matches.map((entry) => ({ ...entry }));
  const updated = matches.find((entry) => entry.id === matchId)!;
  updated.homeScore = isHome ? fixture.pointsFor : fixture.pointsAgainst;
  updated.awayScore = isHome ? fixture.pointsAgainst : fixture.pointsFor;
  updated.winner = userWon ? user : opponent; updated.loser = userWon ? opponent : user; updated.status = "complete";
  updated.userFixture = { ...fixture, opponent, isHome: updated.isNeutral ? false : isHome, isNeutral: updated.isNeutral, result: userWon ? "W" : "L" };
  for (const child of matches.filter((entry) => entry.feederIds?.length && entry.status !== "complete")) {
    const winners = child.feederIds!.map((id) => matches.find((entry) => entry.id === id)?.winner ?? null);
    child.homeTeam = winners[0]; child.awayTeam = winners[1] ?? null;
    child.status = child.homeTeam && child.awayTeam ? "ready" : "pending";
    child.isUserMatch = child.homeTeam === user || child.awayTeam === user;
  }
  const final = matches.find((entry) => entry.id === "gf");
  const complete = final?.status === "complete";
  return {
    ...bracket,
    matches,
    userEliminated: bracket.userEliminated || !userWon,
    tournamentComplete: !!complete,
    // Championship playoffs qualify for the Million Pound Game — not SL title.
    finish: null,
  };
}

export function advanceChampionshipPlayoffsAfterUserMatch(career: ManagerCareer): PlayoffBracketState {
  return simulateAi(career.championshipPlayoffs ?? createChampionshipPlayoffs(career), career);
}

export function ensureChampionshipPlayoffsReady(career: ManagerCareer): ManagerCareer {
  if (!isLeagueAndCupPhaseComplete(career) || !userQualifiedForChampionshipPlayoffs(career)) return career;
  return { ...career, championshipPlayoffs: prepareChampionshipPlayoffRound(career) };
}

export function finalizeChampionshipPlayoffsForMpgEntrant(career: ManagerCareer): ManagerCareer {
  if (!isLeagueAndCupPhaseComplete(career)) return career;
  let bracket = career.championshipPlayoffs ?? createChampionshipPlayoffs(career);
  if (!userQualifiedForChampionshipPlayoffs(career)) bracket = { ...bracket, userEliminated: true };
  bracket = simulateAi(bracket, career);
  return { ...career, championshipPlayoffs: bracket };
}

export function getChampionshipPlayoffWinner(bracket?: PlayoffBracketState): string | null {
  return bracket?.matches.find((match) => match.id === "gf")?.winner ?? null;
}
