import type { PlayoffBracketState, PlayoffBracketMatch } from "../game/playoff-bracket";
import {
  createPlayoffBracket,
  getActiveRound,
  getMatchById,
  getMatchesForRound,
  getPlayoffRoundLabel,
  simulatePlayoffBracketMatch,
} from "../game/playoff-bracket";
import type { MatchFixture } from "../game/season-simulation";
import { buildSquadSlotsFromMatchday } from "./managerSquad";
import type { ManagerCareer, ManagerScheduledFixture } from "./types";
import {
  countCupFixturesPlayed,
  countLeagueFixturesPlayed,
  isLeagueAndCupPhaseComplete,
} from "./managerChallengeCup";
import {
  getManagerLeagueTable,
  getUserLeaguePosition,
  syncManagerLeagueTable,
} from "./managerFixtures";

export const PLAYOFF_QUALIFIERS = 6;

export function userQualifiedForManagerPlayoffs(career: ManagerCareer): boolean {
  return (
    getUserLeaguePosition(getManagerLeagueTable(career), career.club) <=
    PLAYOFF_QUALIFIERS
  );
}


export function createManagerPlayoffs(career: ManagerCareer): PlayoffBracketState {
  const table = getManagerLeagueTable(career);
  const position = getUserLeaguePosition(table, career.club);
  return createPlayoffBracket(
    `${career.seed}-playoffs`,
    table,
    position,
    { currentSeasonOnly: true, userClub: career.club }
  );
}

function findReadyAiPlayoffMatch(
  bracket: PlayoffBracketState
): PlayoffBracketMatch | undefined {
  return bracket.matches
    .filter((m) => m.status === "ready" && !m.isUserMatch)
    .sort((a, b) => a.round - b.round || a.slot - b.slot)[0];
}

function simulateReadyAiPlayoffMatches(
  bracket: PlayoffBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>,
  maxSteps = 48
): PlayoffBracketState {
  let next = bracket;
  for (let step = 0; step < maxSteps; step++) {
    if (next.userEliminated || next.tournamentComplete) break;
    const aiReady = findReadyAiPlayoffMatch(next);
    if (!aiReady) break;
    next = simulatePlayoffBracketMatch(next, aiReady.id, squad);
  }
  return next;
}

function simulateAiUntilUserPlayoffReady(
  bracket: PlayoffBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>
): PlayoffBracketState {
  let next = simulateReadyAiPlayoffMatches(bracket, squad);
  let guard = 0;
  while (guard < 48) {
    guard++;
    const userMatch = next.matches.find(
      (m) => m.isUserMatch && m.status === "ready"
    );
    if (userMatch) return next;
    if (next.userEliminated || next.tournamentComplete) return next;

    const aiReady = findReadyAiPlayoffMatch(next);
    if (!aiReady) break;
    next = simulatePlayoffBracketMatch(next, aiReady.id, squad);
  }
  return next;
}

export function advancePlayoffBracketAfterUserMatch(
  career: ManagerCareer
): PlayoffBracketState {
  const playoffs = career.playoffs;
  if (!playoffs || playoffs.userEliminated || playoffs.tournamentComplete) {
    return playoffs ?? createManagerPlayoffs(career);
  }

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  return simulateReadyAiPlayoffMatches(playoffs, squad);
}

export function preparePlayoffRound(
  career: ManagerCareer
): PlayoffBracketState {
  const bracket = career.playoffs;
  if (!bracket || bracket.userEliminated || bracket.tournamentComplete) {
    return bracket ?? createManagerPlayoffs(career);
  }

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  return simulateAiUntilUserPlayoffReady(bracket, squad);
}

export function getUserPlayoffMatch(
  bracket: PlayoffBracketState
): {
  matchId: string;
  opponent: string;
  isHome: boolean;
  round: number;
} | null {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;
  const userClub = bracket.userClub;
  if (!userClub) return null;

  const round = getActiveRound(bracket);
  const match = getMatchesForRound(bracket, round).find(
    (m) => m.isUserMatch && m.status === "ready"
  );
  if (!match || !match.homeTeam || !match.awayTeam) return null;

  const isHome = match.homeTeam === userClub;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  return { matchId: match.id, opponent, isHome, round };
}

export function buildPlayoffScheduledFixture(
  career: ManagerCareer,
  playoffMatch: NonNullable<ReturnType<typeof getUserPlayoffMatch>>
): ManagerScheduledFixture {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const roundLabel = getPlayoffRoundLabel(playoffMatch.round);
  return {
    id: `playoff-${playoffMatch.matchId}`,
    round: leaguePlayed + countCupFixturesPlayed(career) + 1,
    opponent: playoffMatch.opponent,
    isHome: playoffMatch.isHome,
    competition: "playoffs",
    playoffMatchId: playoffMatch.matchId,
    playoffRound: playoffMatch.round,
    label: `Play-Offs — ${roundLabel}`,
  };
}

export function ensurePlayoffsReady(career: ManagerCareer): ManagerCareer {
  const synced = syncManagerLeagueTable(career);
  if (!isLeagueAndCupPhaseComplete(synced)) {
    return synced;
  }
  if (!userQualifiedForManagerPlayoffs(synced)) return synced;

  let playoffs = synced.playoffs ?? createManagerPlayoffs(synced);
  playoffs = preparePlayoffRound({ ...synced, playoffs });
  return { ...synced, playoffs };
}

export function getPlayoffHubStatus(career: ManagerCareer): string {
  const playoffs = career.playoffs;
  if (!playoffs) {
    if (!isLeagueAndCupPhaseComplete(career)) return "Play-Offs: After league & cup";
    if (!userQualifiedForManagerPlayoffs(career)) return "Play-Offs: Missed (7th+)";
    return "Play-Offs: Starting soon";
  }
  if (playoffs.finish === "Super League Champions") return "Play-Offs: Champions";
  if (playoffs.userEliminated) {
    return `Play-Offs: ${playoffs.finish ?? "Eliminated"}`;
  }
  if (playoffs.tournamentComplete) return "Play-Offs: Complete";

  const match = getUserPlayoffMatch(playoffs);
  if (match) {
    return `Play-Offs: ${getPlayoffRoundLabel(match.round)} vs ${match.opponent}`;
  }
  return "Play-Offs: In progress";
}

export function applyPlayoffMatchToBracket(
  career: ManagerCareer,
  playoffMatchId: string,
  fixture: MatchFixture
): PlayoffBracketState {
  const bracket = career.playoffs!;
  const match = getMatchById(bracket, playoffMatchId);
  if (!match || match.status !== "ready" || !match.homeTeam || !match.awayTeam) {
    return bracket;
  }

  const userClub = bracket.userClub ?? career.club;
  const isHome = match.homeTeam === userClub;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const homeScore = isHome ? fixture.pointsFor : fixture.pointsAgainst;
  const awayScore = isHome ? fixture.pointsAgainst : fixture.pointsFor;
  const winner = fixture.result === "W" ? userClub : opponent;
  const loser = fixture.result === "W" ? opponent : userClub;

  const detail = fixture.scoringDetail;
  const scoringDetail = detail
    ? {
        home: isHome ? detail.dreamTeam : detail.opponent,
        away: isHome ? detail.opponent : detail.dreamTeam,
      }
    : null;

  const matches = bracket.matches.map((m) => ({ ...m }));
  const m = matches.find((x) => x.id === playoffMatchId)!;
  m.homeScore = homeScore;
  m.awayScore = awayScore;
  m.winner = winner;
  m.loser = loser;
  m.status = "complete";
  m.scoringDetail = scoringDetail;
  m.userFixture = {
    ...fixture,
    opponent,
    isHome: match.isNeutral ? false : isHome,
    isNeutral: match.isNeutral,
    result: fixture.result,
  };

  for (const child of matches) {
    if (!child.feederIds?.length || child.status === "complete") continue;
    const feederWinners = child.feederIds.map((feederId) => {
      const feeder = matches.find((fm) => fm.id === feederId);
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
        child.homeTeam === userClub || child.awayTeam === userClub;
    }
  }

  const userLost = fixture.result === "L";
  const userWonFinal = match.round === 3 && fixture.result === "W";
  let finish = bracket.finish;
  if (userLost) {
    finish =
      match.round === 1
        ? "Eliminated in Eliminator"
        : match.round === 2
          ? "Eliminated in Semi-Final"
          : "Grand Final Runner-Up";
  } else if (userWonFinal) {
    finish = "Super League Champions";
  }

  return {
    ...bracket,
    matches,
    userEliminated: userLost,
    tournamentComplete: userLost || userWonFinal,
    finish,
  };
}

export function isPlayoffsPhaseComplete(career: ManagerCareer): boolean {
  if (!userQualifiedForManagerPlayoffs(career)) return true;
  const playoffs = career.playoffs;
  if (!playoffs) return false;
  return playoffs.tournamentComplete || playoffs.userEliminated;
}
