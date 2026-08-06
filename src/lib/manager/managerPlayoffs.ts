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
import { PLAYOFF_QUALIFIERS } from "../game/playoff-simulation";
import { MANAGER_SEASON_GAMES } from "./types";

export { PLAYOFF_QUALIFIERS };

export const GRAND_FINAL_VENUE = "Old Trafford";
export const GRAND_FINAL_ATTENDANCE_MIN = 70_000;
export const GRAND_FINAL_ATTENDANCE_MAX = 80_000;

export function isGrandFinalFixture(
  fixture: Pick<
    ManagerScheduledFixture,
    "competition" | "isNeutral" | "playoffRound"
  >
): boolean {
  return (
    fixture.competition === "playoffs" &&
    (fixture.isNeutral === true || fixture.playoffRound === 3)
  );
}

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

/**
 * Simulate remaining non-user playoff ties.
 * Continues after the user is eliminated so the Grand Final still crowns
 * a Super League champion for World Club Challenge scheduling.
 */
function simulateReadyAiPlayoffMatches(
  bracket: PlayoffBracketState,
  squad: ReturnType<typeof buildSquadSlotsFromMatchday>,
  maxSteps = 48
): PlayoffBracketState {
  let next = bracket;
  for (let step = 0; step < maxSteps; step++) {
    if (next.tournamentComplete) break;
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
    if (next.tournamentComplete) return next;
    if (next.userEliminated) {
      // User is out — finish the rest of the bracket for a real champion.
      return simulateReadyAiPlayoffMatches(next, squad);
    }

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
  if (!playoffs) {
    return createManagerPlayoffs(career);
  }
  if (playoffs.tournamentComplete) return playoffs;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  // Always finish AI ties after a user result (including elimination).
  return simulateReadyAiPlayoffMatches(playoffs, squad);
}

export function preparePlayoffRound(
  career: ManagerCareer
): PlayoffBracketState {
  const bracket = career.playoffs;
  if (!bracket) {
    return createManagerPlayoffs(career);
  }
  if (bracket.tournamentComplete) return bracket;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  if (bracket.userEliminated) {
    return simulateReadyAiPlayoffMatches(bracket, squad);
  }
  return simulateAiUntilUserPlayoffReady(bracket, squad);
}

export function getUserPlayoffMatch(
  bracket: PlayoffBracketState
): {
  matchId: string;
  opponent: string;
  isHome: boolean;
  isNeutral: boolean;
  round: number;
  bracketHome: string;
  bracketAway: string;
} | null {
  if (bracket.userEliminated || bracket.tournamentComplete) return null;
  const userClub = bracket.userClub;
  if (!userClub) return null;

  const round = getActiveRound(bracket);
  const match = getMatchesForRound(bracket, round).find(
    (m) => m.isUserMatch && m.status === "ready"
  );
  if (!match || !match.homeTeam || !match.awayTeam) return null;

  const isNeutral = match.isNeutral;
  const userIsListedHome = match.homeTeam === userClub;
  const opponent = userIsListedHome ? match.awayTeam! : match.homeTeam!;
  const isHome = isNeutral ? false : userIsListedHome;
  return {
    matchId: match.id,
    opponent,
    isHome,
    isNeutral,
    round: match.round,
    bracketHome: match.homeTeam,
    bracketAway: match.awayTeam,
  };
}

export function buildPlayoffScheduledFixture(
  career: ManagerCareer,
  playoffMatch: NonNullable<ReturnType<typeof getUserPlayoffMatch>>
): ManagerScheduledFixture {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const roundLabel = getPlayoffRoundLabel(playoffMatch.round);
  const grandFinal = isGrandFinalFixture({
    competition: "playoffs",
    isNeutral: playoffMatch.isNeutral,
    playoffRound: playoffMatch.round,
  });
  return {
    id: `playoff-${playoffMatch.matchId}`,
    round: leaguePlayed + countCupFixturesPlayed(career) + 1,
    opponent: playoffMatch.opponent,
    isHome: playoffMatch.isHome,
    isNeutral: playoffMatch.isNeutral,
    venue: grandFinal ? GRAND_FINAL_VENUE : undefined,
    listedHome: grandFinal ? playoffMatch.bracketHome : undefined,
    listedAway: grandFinal ? playoffMatch.bracketAway : undefined,
    competition: "playoffs",
    playoffMatchId: playoffMatch.matchId,
    playoffRound: playoffMatch.round,
    label: grandFinal
      ? `Play-Offs — Grand Final at ${GRAND_FINAL_VENUE}`
      : `Play-Offs — ${roundLabel}`,
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

/**
 * Regular league season only — cup progress does not delay this flag.
 * Used for Season Progress playoff visibility.
 */
export function isLeaguePhaseComplete(career: ManagerCareer): boolean {
  const leaguePlayed = countLeagueFixturesPlayed(career);
  const scheduleExhausted =
    career.schedule.length > 0 &&
    career.currentFixtureIndex >= career.schedule.length;
  return (
    leaguePlayed >= MANAGER_SEASON_GAMES ||
    (scheduleExhausted && leaguePlayed > 0)
  );
}

/** Show playoffs in Season Progress only after the league slate is done. */
export function shouldShowPlayoffsInSeasonProgress(
  career: ManagerCareer
): boolean {
  return isLeaguePhaseComplete(career);
}

export function getPlayoffHubStatus(career: ManagerCareer): string | null {
  const playoffs = career.playoffs;
  if (!shouldShowPlayoffsInSeasonProgress(career) && !playoffs) {
    return null;
  }
  if (!playoffs) {
    if (!userQualifiedForManagerPlayoffs(career)) {
      return "Play-Offs: Missed";
    }
    // Bracket starts after cup phase ends (scheduling depends on it).
    if (!isLeagueAndCupPhaseComplete(career)) {
      return "Play-Offs: Qualified";
    }
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

export function isPlayoffMatchReadyForResult(
  career: ManagerCareer,
  playoffMatchId: string
): boolean {
  const bracket = career.playoffs;
  if (!bracket) return false;
  const match = getMatchById(bracket, playoffMatchId);
  return !!(
    match &&
    match.status === "ready" &&
    match.homeTeam &&
    match.awayTeam
  );
}

export function applyPlayoffMatchToBracket(
  career: ManagerCareer,
  playoffMatchId: string,
  fixture: MatchFixture
): PlayoffBracketState | null {
  const bracket = career.playoffs!;
  const match = getMatchById(bracket, playoffMatchId);
  if (!match || match.status !== "ready" || !match.homeTeam || !match.awayTeam) {
    return null;
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

  // User elimination must NOT end the tournament — AI still plays for the title.
  const gfDone = matches.find((x) => x.id === "gf")?.status === "complete";
  const tournamentComplete = userWonFinal || gfDone === true;

  return {
    ...bracket,
    matches,
    userEliminated: userLost || bracket.userEliminated,
    tournamentComplete,
    finish,
  };
}

/**
 * Ensure a Super League Grand Final winner exists for WCC scheduling.
 * Runs remaining AI playoff ties after user elimination, or an AI-only
 * top-six bracket when the user missed the play-offs.
 */
export function finalizePlayoffTournamentForChampion(
  career: ManagerCareer
): ManagerCareer {
  if (!isLeagueAndCupPhaseComplete(career)) return career;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );

  if (!userQualifiedForManagerPlayoffs(career)) {
    // AI-only play-offs among the top six (user club is outside the bracket).
    let playoffs = career.playoffs;
    if (!playoffs || !playoffs.tournamentComplete) {
      playoffs = {
        ...createManagerPlayoffs(career),
        userEliminated: true,
        finish: null,
      };
      playoffs = simulateReadyAiPlayoffMatches(playoffs, squad);
    }
    return { ...career, playoffs };
  }

  let playoffs = career.playoffs ?? createManagerPlayoffs(career);
  if (!playoffs.tournamentComplete) {
    playoffs = simulateReadyAiPlayoffMatches(playoffs, squad);
  }
  return { ...career, playoffs };
}

export function isPlayoffsPhaseComplete(career: ManagerCareer): boolean {
  if (!userQualifiedForManagerPlayoffs(career)) return true;
  const playoffs = career.playoffs;
  if (!playoffs) return false;
  // Prefer a finished tournament; user elimination alone is enough for the
  // manager to leave Matchday, but finalizePlayoffTournamentForChampion must
  // still crown an AI champion before the next season / WCC.
  return playoffs.tournamentComplete || playoffs.userEliminated;
}

export function shouldShowLeagueWinnersCelebration(
  career: ManagerCareer
): boolean {
  if (career.leagueWinnersCelebrationShown) return false;
  if (!isLeagueAndCupPhaseComplete(career)) return false;
  const position = getUserLeaguePosition(
    getManagerLeagueTable(career),
    career.club
  );
  return position === 1;
}

export function needsPlayoffsIntro(career: ManagerCareer): boolean {
  if (career.playoffsIntroAcknowledged) return false;
  if (!isLeagueAndCupPhaseComplete(career)) return false;
  if (!userQualifiedForManagerPlayoffs(career)) return false;
  return true;
}

export function isManagerPlayoffsActive(career: ManagerCareer): boolean {
  if (!career.playoffs || !career.playoffsIntroAcknowledged) return false;
  if (!userQualifiedForManagerPlayoffs(career)) return false;
  return !isPlayoffsPhaseComplete(career);
}

export function acknowledgePlayoffsIntro(career: ManagerCareer): ManagerCareer {
  return ensurePlayoffsReady({
    ...career,
    playoffsIntroAcknowledged: true,
  });
}

export function syncPlayoffsIntroAcknowledged(career: ManagerCareer): ManagerCareer {
  if (career.playoffsIntroAcknowledged) return career;
  const playedPlayoff = career.fixtures.some((f) => f.competition === "playoffs");
  if (playedPlayoff) {
    return { ...career, playoffsIntroAcknowledged: true };
  }
  if (!needsPlayoffsIntro(career)) {
    return { ...career, playoffsIntroAcknowledged: true };
  }
  return career;
}
