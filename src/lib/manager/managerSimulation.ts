import { getPlayerById } from "../players";
import { getManagerPlayer } from "./managerPlayers";
import seedrandom from "seedrandom";
import { getManagerOpponentMatchRating, pruneLeagueListedPlayers } from "./managerLeagueRosters";
import {
  getFriendlyMatchOpponentRating,
  getWccOpponentTeamRating,
} from "./managerOpponentRating";
import { simulateOneFixture } from "../game/season-simulation";
import { getMatchResolutionRules, userWonMustHaveWinnerFixture } from "./matchResolutionRules";
import type { ManagerCareer, ManagerFixtureRecord } from "./types";
import { generateEventsFromFixture } from "./matchEventGenerator";
import {
  buildSquadSlotsFromMatchday,
  isPlayerUnavailable,
  tickInjuries,
} from "./managerSquad";
import { resolveCareerForMatchSimulation } from "./managerAutoFix";
import {
  applyUserMatchToLeagueStates,
  getLeagueClubInjuryPenalty,
  resolveLeagueClubStatesForFixture,
} from "./managerLeagueState";
import {
  buildLeagueTableFromMatches,
  simulateRoundOtherMatches,
  getUserLeaguePosition,
  syncManagerLeagueTable,
} from "./managerFixtures";
import {
  getUserLeagueClubs,
  isUserInChampionship,
} from "./leagueMembership";
import {
  championshipFixturesToRoundMatches,
  markChampionshipUserFixtureResult,
} from "./championship/championshipLeague";
import { getLeagueFixtureSides, isMagicWeekendFixture } from "./managerMagicWeekend";
import { rollPostMatchInjuries } from "./managerTransfers";
import { tickPositionRetraining } from "./managerPositionRetraining";
import { computeManagerTeamRating } from "./managerRating";
import {
  enrichManagerFixtureScoring,
} from "./managerScoring";
import {
  buildTacticEffectivenessLine,
  buildTacticMatchReviewAdvice,
  countTriesByPositionGroup,
  applyTacticFormAdjustment,
  getMatchPlayerRolesStrengthBonus,
  getTacticModifiers,
  resolveEffectiveTactics,
} from "./managerTacticsScoring";
import { updateStatsAfterMatch } from "./managerCareerStats";
import { formDeltaFromMatchRating } from "./managerMatchRating";
import {
  buildMatchWeekId,
  markAwaitingMatchWeekAdvance,
} from "./managerMatchWeek";
import type { MatchFixture } from "../game/season-simulation";
import { processMatchAttendance } from "./managerAttendance";
import {
  applyCupMatchToBracket,
  ensureCupBracketReady,
  advanceCupBracketAfterUserMatch,
  getNextLeagueOrCupFixture,
  isCupMatchReadyForResult,
  isLeagueAndCupPhaseComplete,
} from "./managerChallengeCup";
import {
  advancePlayoffBracketAfterUserMatch,
  applyPlayoffMatchToBracket,
  buildPlayoffScheduledFixture,
  ensurePlayoffsReady,
  finalizePlayoffTournamentForChampion,
  getUserPlayoffMatch,
  isPlayoffMatchReadyForResult,
  isPlayoffsPhaseComplete,
  preparePlayoffRound,
  userQualifiedForManagerPlayoffs,
} from "./managerPlayoffs";
import {
  advanceChampionshipPlayoffsAfterUserMatch,
  applyChampionshipPlayoffMatch,
  buildChampionshipPlayoffScheduledFixture,
  ensureChampionshipPlayoffsReady,
  finalizeChampionshipPlayoffsForMpgEntrant,
  getUserChampionshipPlayoffMatch,
  isChampionshipPlayoffMatchReadyForResult,
  prepareChampionshipPlayoffRound,
  userQualifiedForChampionshipPlayoffs,
} from "./managerChampionshipPlayoffs";
import {
  applyMillionPoundGameResult,
  buildMillionPoundGameScheduledFixture,
  ensureMillionPoundGameReady,
  finalizeMillionPoundGameIfNeeded,
  isMillionPoundGameComplete,
} from "./managerMillionPoundGame";
import {
  buildWorldClubChallengeScheduledFixture,
  completeUserWorldClubChallenge,
  resolveAiWorldClubChallengeIfDue,
} from "./worldClubChallenge";
import { validateMatchEvents } from "../game/validateMatchEvents";
import type { MatchEventType } from "../game/match-events";

export function getNextManagerFixture(
  career: ManagerCareer
): ReturnType<typeof getNextLeagueOrCupFixture> {
  const synced = syncManagerLeagueTable(career);

  // While awaiting Match Week Continue, do not expose the completed fixture as playable.
  if (synced.matchWeekPhase === "awaiting_advance") {
    return null;
  }

  const leagueOrCup = getNextLeagueOrCupFixture(synced);
  const wcc = synced.worldClubChallenge?.currentFixture;
  if (
    wcc &&
    wcc.status === "scheduled" &&
    wcc.userInvolved &&
    leagueOrCup &&
    (leagueOrCup.competition === "league" || !leagueOrCup.competition) &&
    leagueOrCup.round === 3
  ) {
    return buildWorldClubChallengeScheduledFixture(wcc);
  }
  if (leagueOrCup) return leagueOrCup;

  if (!isLeagueAndCupPhaseComplete(synced)) return null;

  if (isUserInChampionship(synced)) {
    let champ = ensureChampionshipPlayoffsReady(synced);
    if (userQualifiedForChampionshipPlayoffs(champ)) {
      const bracket = prepareChampionshipPlayoffRound(champ);
      const match = getUserChampionshipPlayoffMatch(bracket);
      if (match) {
        return buildChampionshipPlayoffScheduledFixture(
          { ...champ, championshipPlayoffs: bracket },
          match
        );
      }
      champ = { ...champ, championshipPlayoffs: bracket };
    }
    const withEntrant = finalizeChampionshipPlayoffsForMpgEntrant(champ);
    const withMpg = ensureMillionPoundGameReady(withEntrant);
    return buildMillionPoundGameScheduledFixture(withMpg);
  }

  // Super League careers also require the Championship play-off winner before
  // the 11th-place club can receive its Million Pound Game fixture.
  const withMpgEntrant = ensureMillionPoundGameReady(
    finalizeChampionshipPlayoffsForMpgEntrant(synced)
  );
  const mpgFixture = buildMillionPoundGameScheduledFixture(withMpgEntrant);
  if (mpgFixture) return mpgFixture;

  if (
    userQualifiedForManagerPlayoffs(synced) &&
    !synced.playoffsIntroAcknowledged
  ) {
    return null;
  }

  const withPlayoffs = ensurePlayoffsReady(synced);
  if (isPlayoffsPhaseComplete(withPlayoffs)) return null;

  const prepared = preparePlayoffRound(withPlayoffs);
  const playoffMatch = getUserPlayoffMatch(prepared);
  if (!playoffMatch) return null;

  return buildPlayoffScheduledFixture(
    { ...withPlayoffs, playoffs: prepared },
    playoffMatch
  );
}

export function isManagerSeasonCompleteLite(career: ManagerCareer): boolean {
  const synced = syncManagerLeagueTable(career);
  if (!isLeagueAndCupPhaseComplete(synced)) return false;
  if (isUserInChampionship(synced)) {
    if (userQualifiedForChampionshipPlayoffs(synced)) {
      const bracket = synced.championshipPlayoffs;
      if (!bracket || (!bracket.tournamentComplete && !bracket.userEliminated)) return false;
    }
    const withMpg = ensureMillionPoundGameReady(
      finalizeChampionshipPlayoffsForMpgEntrant(synced)
    );
    return !withMpg.millionPoundGame?.userParticipating || isMillionPoundGameComplete(withMpg);
  }
  const mpgReady = ensureMillionPoundGameReady(
    finalizeChampionshipPlayoffsForMpgEntrant(synced)
  );
  if (mpgReady.millionPoundGame?.userParticipating && !isMillionPoundGameComplete(mpgReady)) {
    return false;
  }
  if (!userQualifiedForManagerPlayoffs(synced)) return true;
  if (!synced.playoffsIntroAcknowledged) return false;
  const playoffs = synced.playoffs;
  if (!playoffs) return false;
  return isPlayoffsPhaseComplete({ ...synced, playoffs });
}

export function isManagerSeasonComplete(career: ManagerCareer): boolean {
  const synced = syncManagerLeagueTable(career);
  if (!isLeagueAndCupPhaseComplete(synced)) return false;
  if (isUserInChampionship(synced)) return isManagerSeasonCompleteLite(synced);
  const mpgReady = ensureMillionPoundGameReady(
    finalizeChampionshipPlayoffsForMpgEntrant(synced)
  );
  if (mpgReady.millionPoundGame?.userParticipating && !isMillionPoundGameComplete(mpgReady)) {
    return false;
  }
  const withPlayoffs = ensurePlayoffsReady(synced);
  return isPlayoffsPhaseComplete(withPlayoffs);
}

/** Squad + cup/playoff bracket prep before resolving or playing the next fixture. */
export function prepareCareerForNextMatch(career: ManagerCareer): ManagerCareer {
  const simulated = resolveCareerForMatchSimulation(career);
  let next = ensureCupBracketReady(simulated);
  if (isLeagueAndCupPhaseComplete(next)) {
    next = ensureChampionshipPlayoffsReady(next);
    next = finalizeChampionshipPlayoffsForMpgEntrant(next);
    next = ensureMillionPoundGameReady(next);
  }
  return ensurePlayoffsReady(next);
}

import { countExpiringContracts } from "./managerContracts";
import { developSquadAtSeasonEnd } from "./managerPlayerDevelopment";
import {
  advanceLiveToFullTime,
  commandFromTactics,
  createLiveMatch,
  getLiveMatchEvents,
  liveMatchToFixture,
} from "./managerLiveMatch";
import {
  ensureManagerFixtureScoring,
  applyLiveEventsToFixtureScoring,
} from "./managerFixtureScoring";
import {
  applyReserveMatchDevelopment,
  applyYouthMatchDevelopment,
  clearReserveCallUps,
  getReserveOpponent,
  simulateReserveFixture,
  tickLeagueClubReserveCounts,
  ensureAllClubReserveDepth,
} from "./managerReserves";
import { processTransferMarketForWeek } from "./processTransferMarketForWeek";
import { syncManagerInboxMessages } from "./managerInbox";
import { completeFriendlyMatch } from "./managerFriendlies";
import { maybeAddReserveReport } from "./managerReserveReports";
import { applyAutoPromoteByRating } from "./managerReserveRelease";
import { rotateLatestNews } from "./managerNews";
import { processWorldStoryForWeek } from "./managerWorldStory";
import {
  tickChampionshipOnAdvance,
} from "./championship/ensureChampionship";
import { tickAiSuperLeagueOnAdvance } from "./competitionStandings";
import {
  addMatchKeyMomentInboxMessage,
  getManagerMatchKeyMoment,
} from "./managerMatchMoments";
import {
  getManagerDifficultyBoardDelta,
  getManagerDifficultySimAdjustments,
  maybeAddBoardUltimatumInbox,
} from "./managerDifficulty";
import {
  ensureBoardEndOfSeasonReviewInbox,
  maybeAddBoardMilestoneInbox,
} from "./managerBoardInbox";
import {
  generateManagerMatchBio,
  selectManagerManOfTheMatch,
} from "./manager-match-summary";
import { getCommercialMatchIncomeMultiplier } from "./managerFacilities";
import { syncManagerFinance, applyClubRevenue } from "./managerFinance";

export { getTacticModifiers } from "./managerTacticsScoring";

function computePlayerModifiers(
  career: ManagerCareer,
  playerIds: string[]
): { avgForm: number } {
  let formSum = 0;
  let count = 0;
  for (const id of playerIds) {
    if (!id) continue;
    const ps = career.squad.find((p) => p.playerId === id);
    if (ps) {
      if (isPlayerUnavailable(ps)) continue;
      formSum += ps.form;
      count++;
      continue;
    }
    const reserve = career.reserves.find((r) => r.id === id);
    if (reserve) {
      formSum += reserve.form;
      count++;
    }
  }
  return {
    avgForm: count ? formSum / count : 50,
  };
}

/** Apply a completed fixture to career state (simulate or live). */
export type ManagerMatchApplyResult =
  | { ok: true; career: ManagerCareer }
  | { ok: false; career: ManagerCareer; error: string };

function matchApplyFail(
  career: ManagerCareer,
  error: string
): ManagerMatchApplyResult {
  return { ok: false, career, error };
}

export function applyManagerMatchResult(
  career: ManagerCareer,
  fixture: MatchFixture,
  options: {
    playedLive?: boolean;
    schedOverride?: ReturnType<typeof getNextManagerFixture>;
    liveEvents?: import("./types").LiveMatchEvent[];
  } = {}
): ManagerMatchApplyResult {
  if (career.matchWeekPhase === "awaiting_advance") {
    return matchApplyFail(
      career,
      "Progress Week before playing another fixture."
    );
  }
  const sched =
    options.schedOverride ?? getNextManagerFixture(career);
  if (!sched) {
    return matchApplyFail(career, "No fixture is scheduled.");
  }

  const isCup = sched.competition === "challenge_cup";
  const isPlayoff = sched.competition === "playoffs";
  const isChampionshipPlayoff = sched.competition === "championship_playoffs";
  const isMillionPoundGame = sched.competition === "million_pound_game";
  const isFriendly = sched.competition === "friendly";
  const isWcc = sched.competition === "world_club_challenge";
  const skipsLeagueProgress = isCup || isPlayoff || isChampionshipPlayoff || isMillionPoundGame || isFriendly || isWcc;

  if (isCup && sched.cupMatchId && !isCupMatchReadyForResult(career, sched.cupMatchId)) {
    console.warn("Cup match not ready for result:", sched.cupMatchId);
    return matchApplyFail(
      career,
      "Challenge Cup bracket is not ready for this result. Try again from the hub."
    );
  }
  if (
    isPlayoff &&
    sched.playoffMatchId &&
    !isPlayoffMatchReadyForResult(career, sched.playoffMatchId)
  ) {
    console.warn("Playoff match not ready for result:", sched.playoffMatchId);
    return matchApplyFail(
      career,
      "Play-off bracket is not ready for this result. Try again from the hub."
    );
  }
  if (
    isChampionshipPlayoff &&
    sched.playoffMatchId &&
    !isChampionshipPlayoffMatchReadyForResult(career, sched.playoffMatchId)
  ) {
    return matchApplyFail(career, "Championship play-off bracket is not ready for this result.");
  }

  if (career.fixtures.some((f) => f.fixtureId === sched.id)) {
    return matchApplyFail(
      career,
      "This fixture result was already recorded."
    );
  }

  // Knockouts / friendlies / WCC must never persist a draw result.
  if (
    !getMatchResolutionRules({ competition: sched.competition }).allowsDraw &&
    (fixture.result === "D" || fixture.pointsFor === fixture.pointsAgainst)
  ) {
    const fallbackWin =
      seedrandom(`${career.seed}-knockout-break-${sched.id}`)() < 0.5;
    const userWon = userWonMustHaveWinnerFixture(fixture, fallbackWin);
    if (fixture.pointsFor === fixture.pointsAgainst) {
      if (userWon) fixture.pointsFor += 1;
      else fixture.pointsAgainst += 1;
    }
    fixture.result = userWon ? "W" : "L";
  }

  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const effectiveTactics = resolveEffectiveTactics(career, sched.id);
  const careerForMatch: ManagerCareer = {
    ...career,
    tactics: effectiveTactics,
  };
  const mods = getTacticModifiers(effectiveTactics);
  mods.strengthBonus += getMatchPlayerRolesStrengthBonus(
    careerForMatch,
    effectiveTactics
  );

  let savedLiveEvents = options.liveEvents;

  if (options.liveEvents?.length) {
    applyLiveEventsToFixtureScoring(
      careerForMatch,
      fixture,
      options.liveEvents,
      sched.id
    );
    const validated = validateMatchEvents(
      options.liveEvents.map((e) => ({
        id: e.id ?? "",
        minute: e.minute,
        teamId: e.teamId ?? e.team,
        teamName:
          e.teamName ??
          (e.team === "user" ? career.club : sched.opponent),
        playerName: e.playerName,
        kickerName: e.kickerName,
        type: e.type as MatchEventType,
        points: e.points,
        description: e.description,
        importance: e.importance ?? "medium",
        relatedEventId: e.relatedEventId,
      })),
      { id: "user", name: career.club },
      { id: "opp", name: sched.opponent },
      {
        pickFallbackPlayer: (teamId) => {
          if (teamId === "user" || teamId === career.club) {
            const id = career.matchdayXiii.find(Boolean);
            return id
              ? getManagerPlayer(career, id)?.name
              : undefined;
          }
          return undefined;
        },
      }
    );
    if (
      process.env.NODE_ENV === "development" &&
      validated.issues.length > 0
    ) {
      console.warn("[Manager] Match event validation:", validated.issues);
    }
    savedLiveEvents = options.liveEvents.map((e, i) => {
      const repaired = validated.events.find((v) => v.id === e.id) ??
        validated.events[i];
      if (!repaired) return e;
      return {
        ...e,
        playerName: repaired.playerName ?? e.playerName,
        kickerName: repaired.kickerName ?? e.kickerName,
        points: repaired.points ?? e.points,
        description: repaired.description || e.description,
      };
    });
    applyLiveEventsToFixtureScoring(
      careerForMatch,
      fixture,
      savedLiveEvents,
      sched.id
    );
    const eventTryTotal =
      fixture.scoringDetail?.dreamTeam.tryScorers.reduce(
        (sum, t) => sum + t.tries,
        0
      ) ?? 0;
    const hasPlaceholderScorers =
      fixture.scoringDetail?.dreamTeam.tryScorers.some((s) =>
        /^(try scorer|opposition try scorer|unknown)$/i.test(s.name)
      ) ?? false;
    if (eventTryTotal !== fixture.triesFor || hasPlaceholderScorers) {
      enrichManagerFixtureScoring(
        squad,
        fixture,
        career.seed,
        effectiveTactics,
        {
          currentSeasonOnly: true,
          fixtureKey: sched.id,
          career: careerForMatch,
        }
      );
    }
  } else {
    enrichManagerFixtureScoring(
      squad,
      fixture,
      career.seed,
      effectiveTactics,
      {
        currentSeasonOnly: true,
        fixtureKey: sched.id,
        career: careerForMatch,
      }
    );
  }
  ensureManagerFixtureScoring(careerForMatch, fixture, squad, sched.id);

  const matchdayIdList = [
    ...career.matchdayXiii.filter(Boolean),
    ...career.matchdayInterchange.filter(Boolean),
  ];
  const motm = selectManagerManOfTheMatch(
    fixture,
    careerForMatch,
    matchdayIdList,
    career.seed,
    sched.id
  );
  const motmId = motm?.teamName === career.club ? motm.playerId : null;
  const userScorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
  const { forward, back } = countTriesByPositionGroup(
    userScorers,
    career.xiiiSlotPositions,
    career.matchdayXiii
  );
  const effectivenessLine = buildTacticEffectivenessLine(
    effectiveTactics,
    fixture.result === "W",
    fixture.triesFor,
    fixture.triesAgainst,
    forward,
    back,
    fixture.scoringDetail?.opponent.tryScorers ?? []
  );
  const tacticReview = buildTacticMatchReviewAdvice(
    effectiveTactics,
    fixture.result === "W",
    fixture.pointsFor,
    fixture.pointsAgainst,
    fixture.triesFor,
    fixture.triesAgainst,
    forward,
    back,
    fixture.scoringDetail?.opponent.tryScorers ?? []
  );

  const won = fixture.result === "W";
  const isDraw = fixture.result === "D";

  let roundResults = career.roundMatches;
  let leagueTable = career.leagueTable;
  let championshipCompetition = career.championshipCompetition;
  let leagueStates = resolveLeagueClubStatesForFixture(
    career,
    !isCup && !skipsLeagueProgress ? round : career.gameWeek || round
  );

  if (!isCup && !skipsLeagueProgress) {
    const sides = getLeagueFixtureSides(career.club, sched);
    const userIsListedHome = sides.homeTeam === career.club;
    const userMatch = {
      round,
      homeTeam: sides.homeTeam,
      awayTeam: sides.awayTeam,
      homeScore: userIsListedHome ? fixture.pointsFor : fixture.pointsAgainst,
      awayScore: userIsListedHome ? fixture.pointsAgainst : fixture.pointsFor,
      homeTries: userIsListedHome ? fixture.triesFor : fixture.triesAgainst,
      awayTries: userIsListedHome ? fixture.triesAgainst : fixture.triesFor,
    };

    // User result only — AI round fixtures process on Match Week Continue.
    roundResults = [...career.roundMatches, userMatch];
    leagueTable = buildLeagueTableFromMatches(
      roundResults,
      career.club,
      getUserLeagueClubs(career)
    );

    if (isUserInChampionship(career) && championshipCompetition) {
      const homeDetail = userIsListedHome
        ? fixture.scoringDetail?.dreamTeam
        : fixture.scoringDetail?.opponent;
      const awayDetail = userIsListedHome
        ? fixture.scoringDetail?.opponent
        : fixture.scoringDetail?.dreamTeam;
      const champMatchDetail =
        homeDetail && awayDetail
          ? {
              home: homeDetail,
              away: awayDetail,
              homeTries: userMatch.homeTries,
              awayTries: userMatch.awayTries,
              events: [],
              story: `${userMatch.homeTeam} ${userMatch.homeScore}-${userMatch.awayScore} ${userMatch.awayTeam}`,
            }
          : undefined;
      championshipCompetition = markChampionshipUserFixtureResult(
        championshipCompetition,
        round,
        userMatch.homeTeam,
        userMatch.awayTeam,
        userMatch.homeScore,
        userMatch.awayScore,
        userMatch.homeTries,
        userMatch.awayTries,
        career.club,
        champMatchDetail
      );
    }
  }

  const aggressiveDefence =
    effectiveTactics.defenceFocus === "aggressive_contact";
  const injuries = rollPostMatchInjuries(
    career.matchdayXiii,
    career.seed,
    round,
    mods.fatigueFactor,
    aggressiveDefence
  );

  leagueStates = applyUserMatchToLeagueStates(
    leagueStates,
    career.club,
    sched.opponent,
    injuries.length,
    career.seed,
    round
  );

  const matchdayIds = new Set([
    ...career.matchdayXiii.filter(Boolean),
    ...career.matchdayInterchange.filter(Boolean),
  ]);

  let nextSquad = tickInjuries(career.squad).map((ps) => {
    const played = matchdayIds.has(ps.playerId);
    const tryCount =
      fixture.scoringDetail?.dreamTeam.tryScorers.find(
        (t) => t.playerId === ps.playerId
      )?.tries ?? 0;

    const inj = injuries.find((i) => i.playerId === ps.playerId);
    return {
      ...ps,
      // Form is updated from match ratings below (not win/loss-only).
      form: ps.form,
      injury: inj?.injury ?? ps.injury,
      seasonAppearances: played ? ps.seasonAppearances + 1 : ps.seasonAppearances,
      seasonTries: ps.seasonTries + tryCount,
    };
  });

  const statsUpdate = updateStatsAfterMatch(
    career,
    { ...fixture, liveEvents: savedLiveEvents },
    squad,
    matchdayIdList,
    motmId,
    savedLiveEvents
  );
  const teamSeasonStats = isFriendly || isWcc
    ? career.teamSeasonStats
    : statsUpdate.teamSeasonStats;
  const recentForm = statsUpdate.recentForm;

  // Rolling form from match performance ratings (ability stays separate).
  nextSquad = nextSquad.map((ps) => {
    const matchRating = statsUpdate.matchRatingsByPlayer[ps.playerId];
    if (matchRating == null) return ps;
    const delta = formDeltaFromMatchRating(matchRating);
    return {
      ...ps,
      form: Math.max(1, Math.min(99, ps.form + delta)),
    };
  });

  let working: ManagerCareer = { ...career, squad: nextSquad };

  const { career: withAttendance, meta: attendanceMeta } =
    processMatchAttendance(working, sched, fixture);
  working = withAttendance;

  let challengeCup = working.challengeCup;
  if (isCup && sched.cupMatchId) {
    const updated = applyCupMatchToBracket(working, sched.cupMatchId, fixture);
    if (!updated) {
      console.warn("Cup bracket update failed:", sched.cupMatchId);
      return matchApplyFail(
        career,
        "Could not update the Challenge Cup bracket for this match."
      );
    }
    challengeCup = updated;
    working = { ...working, challengeCup };
    if (!challengeCup.userEliminated && !challengeCup.tournamentComplete) {
      challengeCup = advanceCupBracketAfterUserMatch(working);
      working = { ...working, challengeCup };
    }
  }

  let playoffs = working.playoffs;
  if (isPlayoff && sched.playoffMatchId) {
    const updated = applyPlayoffMatchToBracket(
      working,
      sched.playoffMatchId,
      fixture
    );
    if (!updated) {
      console.warn("Playoff bracket update failed:", sched.playoffMatchId);
      return matchApplyFail(
        career,
        "Could not update the play-off bracket for this match."
      );
    }
    playoffs = updated;
    working = { ...working, playoffs };
    // Finish remaining AI ties even after the user is eliminated so WCC
    // schedules against the real Super League champion, not the user by default.
    if (!playoffs.tournamentComplete) {
      playoffs = advancePlayoffBracketAfterUserMatch(working);
      working = { ...working, playoffs };
    }
  }
  if (isChampionshipPlayoff && sched.playoffMatchId) {
    const updated = applyChampionshipPlayoffMatch(working, sched.playoffMatchId, fixture);
    if (!updated) return matchApplyFail(career, "Could not update the Championship play-off bracket.");
    working = { ...working, championshipPlayoffs: updated };
    if (!updated.tournamentComplete) {
      working = {
        ...working,
        championshipPlayoffs: advanceChampionshipPlayoffsAfterUserMatch(working),
      };
    }
  }
  if (isMillionPoundGame) {
    working = ensureMillionPoundGameReady(
      finalizeChampionshipPlayoffsForMpgEntrant(working)
    );
    working = applyMillionPoundGameResult(
      working,
      won ? career.club : sched.opponent
    );
  }

  const fixtureWithMotm: MatchFixture = motm
    ? { ...fixture, manOfTheMatch: motm }
    : fixture;

  const record: ManagerFixtureRecord = {
    ...fixtureWithMotm,
    userClub: career.club,
    fixtureId: sched.id,
    competition: sched.competition,
    meta: {
      tacticImpactLine: mods.tacticLine,
      tacticEffectivenessLine: effectivenessLine,
      tacticReview,
      injuries: injuries.map((i) => ({
        ...i,
        name: getPlayerById(i.playerId)?.name ?? "Player",
      })),
      playerOfMatchId: motm?.playerId ?? null,
      matchRatingsByPlayer: statsUpdate.matchRatingsByPlayer,
      playedLive: options.playedLive ?? false,
      attendance: attendanceMeta ?? undefined,
      competition: sched.competition,
      cupRound: sched.cupRound,
      liveEvents: savedLiveEvents,
      matchdayXiii: [...career.matchdayXiii],
      matchdayInterchange: [...career.matchdayInterchange],
      xiiiSlotPositions: [...career.xiiiSlotPositions],
    },
  };

  const position = getUserLeaguePosition(leagueTable, career.club);

  const matchBio = generateManagerMatchBio(fixtureWithMotm, career.seed, {
    clubName: career.club,
    competition: sched.competition,
    cupRound: sched.cupRound,
    tactics: effectiveTactics,
    tacticImpactLine: mods.tacticLine,
    tacticEffectivenessLine: effectivenessLine,
    attendance: attendanceMeta ?? undefined,
    playedLive: options.playedLive ?? false,
    liveEvents: savedLiveEvents,
    injuryCount: injuries.length,
    injuries: injuries.map(
      (i) => getPlayerById(i.playerId)?.name ?? "Player"
    ),
    forwardTries: forward,
    backTries: back,
    recentForm: career.recentForm,
    tablePosition:
      !isCup && !skipsLeagueProgress ? position : undefined,
  });
  fixtureWithMotm.matchBio = matchBio;
  record.matchBio = matchBio;

  let boardConfidence = career.boardConfidence;
  if (won) boardConfidence = Math.min(100, boardConfidence + 3);
  else if (isDraw) boardConfidence = Math.max(0, boardConfidence - 1);
  else boardConfidence = Math.max(0, boardConfidence - 4);
  if (position <= 4) boardConfidence = Math.min(100, boardConfidence + 1);
  if (position >= 12) boardConfidence = Math.max(0, boardConfidence - 2);
  if (isCup && won) boardConfidence = Math.min(100, boardConfidence + 5);
  if (isCup && !won) boardConfidence = Math.max(0, boardConfidence - 3);
  if (isPlayoff && won) boardConfidence = Math.min(100, boardConfidence + 6);
  if (isPlayoff && !won) boardConfidence = Math.max(0, boardConfidence - 5);
  if (isWcc && won) boardConfidence = Math.min(100, boardConfidence + 5);
  if (isWcc && !won) boardConfidence = Math.max(0, boardConfidence - 3);

  let wagePressureWeeks = career.wagePressureWeeks ?? 0;
  if (career.wageBill > career.wageBudget) {
    wagePressureWeeks += 1;
    boardConfidence = Math.max(0, boardConfidence - 2);
    if (wagePressureWeeks >= 4) {
      boardConfidence = Math.max(0, boardConfidence - 4);
    }
  } else {
    wagePressureWeeks = 0;
  }
  const expiring = countExpiringContracts(career);
  if (expiring >= 4) boardConfidence = Math.max(0, boardConfidence - 3);

  boardConfidence = Math.max(
    0,
    Math.min(
      100,
      boardConfidence + getManagerDifficultyBoardDelta(career, position, won)
    )
  );

  const commercialMult = getCommercialMatchIncomeMultiplier(
    career.clubFacilities?.commercial ?? 0
  );
  const matchIncome = isMagicWeekendFixture(sched)
    ? 0
    : Math.round(
        (isFriendly
          ? won
            ? 4_000
            : isDraw
              ? 3_000
              : 2_000
          : won
            ? 15_000
            : isDraw
              ? 9_000
              : 6_000) * commercialMult
      );
  const cupBonus = isCup && won ? 30_000 : 0;
  const wccBonus = isWcc && won ? 40_000 : 0;

  const nextCareer: ManagerCareer = {
    ...working,
    championshipCompetition,
    leagueClubStates: leagueStates,
    leagueClubStatesWeek:
      !isCup && !skipsLeagueProgress
        ? round
        : career.leagueClubStatesWeek,
    fixtures: [...career.fixtures, record],
    roundMatches: roundResults,
    leagueTable,
    currentRound: isFriendly ? career.currentRound : round,
    // gameWeek / fixture index stay until advanceManagerMatchWeek
    gameWeek: career.gameWeek,
    currentFixtureIndex: career.currentFixtureIndex,
    wins:
      skipsLeagueProgress
        ? career.wins
        : career.wins + (won ? 1 : 0),
    losses:
      skipsLeagueProgress
        ? career.losses
        : career.losses + (!won && !isDraw ? 1 : 0),
    draws:
      skipsLeagueProgress
        ? (career.draws ?? 0)
        : (career.draws ?? 0) + (isDraw ? 1 : 0),
    boardConfidence,
    teamSeasonStats,
    playerSeasonStats: statsUpdate.playerSeasonStats,
    recentForm,
    isSeasonComplete: false,
    lastMatchFixture: record,
    challengeCup,
    playoffs,
    wagePressureWeeks,
    nextMatchGameplan:
      career.nextMatchGameplan?.fixtureId === sched.id
        ? null
        : career.nextMatchGameplan,
    updatedAt: new Date().toISOString(),
  };

  let finalCareer: ManagerCareer = ensureMillionPoundGameReady(
    ensureChampionshipPlayoffsReady(ensurePlayoffsReady(syncManagerLeagueTable(nextCareer)))
  );
  if (matchIncome > 0) {
    finalCareer = applyClubRevenue(finalCareer, matchIncome, "match_fee");
  }
  if (cupBonus > 0) {
    finalCareer = applyClubRevenue(finalCareer, cupBonus, "cup_prize");
  }
  if (wccBonus > 0) {
    finalCareer = applyClubRevenue(finalCareer, wccBonus, "cup_prize");
  }

  // Immediate match aftermath (reserves tied to this fixture opponent).
  const reserveOpp = getReserveOpponent(sched.opponent, round, career.seed);
  finalCareer = tickLeagueClubReserveCounts(finalCareer, round);
  finalCareer = ensureAllClubReserveDepth(finalCareer);
  const reserveResult = simulateReserveFixture(finalCareer, round, reserveOpp);
  finalCareer = applyYouthMatchDevelopment(finalCareer, { round, matchdayIds });
  finalCareer = applyReserveMatchDevelopment(finalCareer, reserveResult);
  const calledUpReserveCount = finalCareer.calledUpReserveIds.length;
  finalCareer = clearReserveCallUps(finalCareer);
  finalCareer = syncManagerInboxMessages(finalCareer);
  const keyMoment = getManagerMatchKeyMoment(
    record,
    career.club,
    sched.competition
  );
  if (keyMoment && !options.playedLive) {
    finalCareer = addMatchKeyMomentInboxMessage(
      finalCareer,
      record,
      keyMoment
    );
  }
  finalCareer = maybeAddBoardUltimatumInbox(finalCareer);
  if (isFriendly) {
    finalCareer = completeFriendlyMatch(finalCareer);
  }
  if (isWcc) {
    const storySummary =
      fixtureWithMotm.matchBio ??
      (won
        ? `${career.club} lifted the World Club Challenge, beating ${sched.opponent} ${fixture.pointsFor}–${fixture.pointsAgainst}.`
        : `${sched.opponent} beat ${career.club} ${fixture.pointsAgainst}–${fixture.pointsFor} in the World Club Challenge.`);
    finalCareer = completeUserWorldClubChallenge(
      finalCareer,
      fixture.pointsFor,
      fixture.pointsAgainst,
      savedLiveEvents ?? [],
      storySummary
    );
  }
  finalCareer = syncManagerFinance(finalCareer);

  finalCareer = maybeAddBoardMilestoneInbox(finalCareer, {
    fixture: record,
    previousBoardConfidence: career.boardConfidence,
    calledUpReserveCount,
  });

  const weekId = buildMatchWeekId(career, sched.id, round);
  finalCareer = markAwaitingMatchWeekAdvance(finalCareer, weekId);

  // Shared form carry for hub Simulate and Play Game.
  const { avgForm } = computePlayerModifiers(career, [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]);
  const teamForm = Math.max(-10, Math.min(10, (avgForm - 50) / 5));
  const combinedForm = Math.max(
    -4,
    Math.min(8, teamForm + career.matchSimState.form * 0.2)
  );
  finalCareer = {
    ...finalCareer,
    matchSimState: {
      form:
        fixture.result === "W"
          ? Math.min(8, combinedForm + 1.5)
          : fixture.result === "D"
            ? combinedForm
            : Math.max(-4, combinedForm - 1.5),
      seasonDropGoals:
        career.matchSimState.seasonDropGoals +
        (fixture.scoringFor?.dropGoals ?? 0) +
        (fixture.scoringAgainst?.dropGoals ?? 0),
    },
  };

  return { ok: true, career: pruneLeagueListedPlayers(finalCareer) };
}

/**
 * Process deferred Match Week systems once from Season Progress → Advance Week.
 * Guarded by pendingMatchWeekId vs lastProcessedMatchWeekId.
 */
export function advanceManagerMatchWeek(
  career: ManagerCareer
): { ok: true; career: ManagerCareer } | { ok: false; career: ManagerCareer; error: string } {
  if (career.matchWeekPhase !== "awaiting_advance") {
    return {
      ok: false,
      career,
      error: "There is no Match Week waiting to be advanced.",
    };
  }

  const weekId = career.pendingMatchWeekId;
  if (!weekId) {
    return {
      ok: true,
      career: {
        ...career,
        matchWeekPhase: "ready_to_play",
        pendingMatchWeekId: null,
      },
    };
  }

  if (career.lastProcessedMatchWeekId === weekId) {
    return {
      ok: true,
      career: {
        ...career,
        matchWeekPhase: career.isSeasonComplete
          ? "season_complete"
          : "ready_to_play",
        pendingMatchWeekId: null,
      },
    };
  }

  const last = career.lastMatchFixture;
  const skipsLeagueProgress =
    last?.competition === "challenge_cup" ||
    last?.competition === "playoffs" ||
    last?.competition === "championship_playoffs" ||
    last?.competition === "million_pound_game" ||
    last?.competition === "friendly" ||
    last?.competition === "world_club_challenge";

  let next: ManagerCareer = { ...career };
  const round = last?.round ?? career.currentRound;

  if (last && last.competition === "league") {
    const sched = career.schedule[career.currentFixtureIndex];
    const sides = sched
      ? getLeagueFixtureSides(career.club, sched)
      : {
          homeTeam: last.isHome ? career.club : last.opponent,
          awayTeam: last.isHome ? last.opponent : career.club,
        };
    const userIsListedHome = sides.homeTeam === career.club;
    const userMatch = {
      round,
      homeTeam: sides.homeTeam,
      awayTeam: sides.awayTeam,
      homeScore: userIsListedHome ? last.pointsFor : last.pointsAgainst,
      awayScore: userIsListedHome ? last.pointsAgainst : last.pointsFor,
      homeTries: userIsListedHome ? last.triesFor : last.triesAgainst,
      awayTries: userIsListedHome ? last.triesAgainst : last.triesFor,
    };

    if (isUserInChampionship(career)) {
      // Advance Champ AI fixtures for this week, then mirror standings into the user table.
      next = {
        ...next,
        gameWeek: round,
        currentFixtureIndex: career.currentFixtureIndex + 1,
        currentRound: round,
      };
      next = tickChampionshipOnAdvance(next);
      next = tickAiSuperLeagueOnAdvance(next);
      const champFixtures = next.championshipCompetition?.fixtures ?? [];
      const roundMatches = championshipFixturesToRoundMatches(champFixtures);
      next = {
        ...next,
        roundMatches,
        leagueTable: buildLeagueTableFromMatches(
          roundMatches,
          career.club,
          getUserLeagueClubs(next)
        ),
      };
    } else {
      // Drop any incomplete user-only row for this round then expand with AI.
      const withoutThisRoundUser = career.roundMatches.filter((m) => {
        if (m.round !== round) return true;
        const involvesUser =
          m.homeTeam === career.club || m.awayTeam === career.club;
        return !involvesUser;
      });

      const leagueStates = resolveLeagueClubStatesForFixture(career, round);
      const roundResults = [
        ...withoutThisRoundUser,
        ...simulateRoundOtherMatches(
          career.club,
          last.opponent,
          round,
          career.seed,
          userMatch,
          leagueStates,
          career
        ),
      ];
      next = {
        ...next,
        roundMatches: roundResults,
        leagueTable: buildLeagueTableFromMatches(
          roundResults,
          career.club,
          getUserLeagueClubs(career)
        ),
        gameWeek: round,
        currentFixtureIndex: career.currentFixtureIndex + 1,
        currentRound: round,
      };
    }
  } else if (!skipsLeagueProgress && last) {
    next = {
      ...next,
      gameWeek: round,
      currentFixtureIndex: career.currentFixtureIndex + 1,
      currentRound: round,
    };
  }

  next = syncManagerLeagueTable(next);
  // All transfer/loan/AI market activity runs once per gameWeek.
  next = processTransferMarketForWeek(next);
  next = syncManagerInboxMessages(next);
  next = processWorldStoryForWeek(next);
  if (last?.competition === "league") {
    next = tickPositionRetraining(next);
  }
  next = maybeAddReserveReport(next);
  next = applyAutoPromoteByRating(next);
  next = tickChampionshipOnAdvance(next);
  next = tickAiSuperLeagueOnAdvance(next);
  next = rotateLatestNews(next);

  next = syncManagerFinance(next);
  next = ensureMillionPoundGameReady(
    ensureChampionshipPlayoffsReady(ensurePlayoffsReady(next))
  );
  // After elimination (or season end), finish AI play-offs so WCC uses the real champion.
  if (next.playoffs?.userEliminated || isManagerSeasonCompleteLite(next)) {
    next = finalizePlayoffTournamentForChampion(next);
  }
  next = finalizeMillionPoundGameIfNeeded(
    finalizeChampionshipPlayoffsForMpgEntrant(next)
  );
  const seasonDone = isManagerSeasonComplete(next);
  if (seasonDone && !next.lastSeasonDevelopmentReview) {
    const developed = developSquadAtSeasonEnd(next);
    next = {
      ...developed.career,
      isSeasonComplete: true,
      lastSeasonDevelopmentReview: developed.changes,
    };
  } else {
    next = { ...next, isSeasonComplete: seasonDone };
  }

  next = {
    ...pruneLeagueListedPlayers(next),
    matchWeekPhase: next.isSeasonComplete ? "season_complete" : "ready_to_play",
    pendingMatchWeekId: null,
    lastProcessedMatchWeekId: weekId,
    updatedAt: new Date().toISOString(),
  };

  if (next.isSeasonComplete) {
    next = ensureBoardEndOfSeasonReviewInbox(next);
  }

  // AI WCC result only after Game Week 3 (gameday) has passed.
  next = resolveAiWorldClubChallengeIfDue(next);

  return { ok: true, career: next };
}

export function previewManagerMatchScoreline(
  career: ManagerCareer,
  sched: NonNullable<ReturnType<typeof getNextManagerFixture>>
): MatchFixture {
  const simCareer = resolveCareerForMatchSimulation(career);
  const isFriendly = sched.competition === "friendly";
  const isWcc = sched.competition === "world_club_challenge";
  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    simCareer.matchdayXiii,
    simCareer.xiiiSlotPositions,
    simCareer
  );
  const effectiveTactics = resolveEffectiveTactics(simCareer, sched.id);
  const mods = getTacticModifiers(effectiveTactics);
  mods.strengthBonus += getMatchPlayerRolesStrengthBonus(
    simCareer,
    effectiveTactics
  );
  const { avgForm } = computePlayerModifiers(simCareer, [
    ...simCareer.matchdayXiii,
    ...simCareer.matchdayInterchange,
  ]);

  const leagueStates = resolveLeagueClubStatesForFixture(
    simCareer,
    isFriendly ? simCareer.gameWeek || round : round
  );
  const opponentInjuryPenalty = getLeagueClubInjuryPenalty(
    leagueStates,
    sched.opponent
  );

  const teamForm = Math.max(-10, Math.min(10, (avgForm - 50) / 5));
  const userRating = computeManagerTeamRating(
    simCareer.matchdayXiii,
    simCareer.matchdayInterchange,
    simCareer.xiiiSlotPositions,
    simCareer
  );
  const baseOppRating = isFriendly
    ? getFriendlyMatchOpponentRating(
        simCareer,
        sched.opponent,
        round,
        sched.id
      )
    : isWcc
      ? getWccOpponentTeamRating(simCareer, sched.opponent)
      : getManagerOpponentMatchRating(
          simCareer,
          sched.opponent,
          simCareer.seed,
          round
        );
  const homeAdj = sched.isNeutral ? 0 : sched.isHome ? 5 : -1;
  const ratingGap = userRating - baseOppRating + homeAdj;
  const formFromRatings = Math.max(-3, Math.min(7, ratingGap * 0.4));
  const combinedForm = applyTacticFormAdjustment(
    Math.max(
      -2,
      Math.min(
        8,
        teamForm + simCareer.matchSimState.form * 0.12 + formFromRatings
      )
    ),
    mods
  );
  const difficultyAdj = getManagerDifficultySimAdjustments(simCareer);

  const strengthBias =
    userRating > baseOppRating
      ? Math.min(8, (userRating - baseOppRating) * 0.35)
      : 0;

  const opponentRating =
    baseOppRating +
    mods.opponentPenalty * 0.12 -
    mods.strengthBonus * 0.25 -
    strengthBias -
    opponentInjuryPenalty +
    difficultyAdj.opponentRatingDelta;

  const allowDraw = getMatchResolutionRules({
    competition: sched.competition,
  }).allowsDraw;

  const { fixture } = simulateOneFixture(
    squad,
    sched.opponent,
    sched.isNeutral ? false : sched.isHome,
    round,
    simCareer.seed,
    {
      form: combinedForm + difficultyAdj.formDelta,
      seasonDropGoals: simCareer.matchSimState.seasonDropGoals,
    },
    {
      currentSeasonOnly: !isFriendly && !isWcc,
      opponentRatingOverride: opponentRating,
      userRatingOverride: userRating,
      cupMode: sched.competition === "challenge_cup",
      managerCareerMode: true,
      matchKey: isFriendly || isWcc ? `${simCareer.seed}-${sched.id}` : undefined,
      allowDraw,
    }
  );

  if (sched.isNeutral) {
    fixture.isNeutral = true;
  }

  return fixture;
}

/** Run instant full-time simulation using the same score engine as other modes. */
export function simulateManagerMatchLive(
  career: ManagerCareer,
  sched: NonNullable<ReturnType<typeof getNextManagerFixture>>
): { fixture: MatchFixture; liveEvents: import("./types").LiveMatchEvent[] } {
  let fixture = previewManagerMatchScoreline(career, sched);

  // Root-cause fix: scoreline-only simulateOneFixture leaves scoringDetail empty.
  // Allocate per-try scorers BEFORE event generation so Match Story / stats share IDs.
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const effectiveTactics = resolveEffectiveTactics(career, sched.id);
  const careerForMatch: ManagerCareer = {
    ...career,
    tactics: effectiveTactics,
  };
  enrichManagerFixtureScoring(
    squad,
    fixture,
    career.seed,
    effectiveTactics,
    {
      currentSeasonOnly:
        sched.competition !== "friendly" &&
        sched.competition !== "world_club_challenge",
      fixtureKey: sched.id,
      career: careerForMatch,
    }
  );
  if (process.env.NODE_ENV === "development") {
    (fixture as MatchFixture & { __simEngine?: string }).__simEngine =
      "manager-instant-v2";
  }

  const liveEvents = generateEventsFromFixture(career, fixture, sched.id, sched);
  return { fixture, liveEvents };
}

export function simulateManagerNextMatch(
  career: ManagerCareer
): ManagerMatchApplyResult {
  if (career.matchWeekPhase === "awaiting_advance") {
    return matchApplyFail(
      career,
      "Progress Week before playing another fixture."
    );
  }
  if (isManagerSeasonComplete(career)) {
    return matchApplyFail(career, "The season is already complete.");
  }

  const ready = prepareCareerForNextMatch(career);
  const sched = getNextManagerFixture(ready);
  if (!sched) {
    return matchApplyFail(ready, "No fixture is scheduled.");
  }

  const { fixture, liveEvents } = simulateManagerMatchLive(ready, sched);

  const result = applyManagerMatchResult(ready, fixture, {
    schedOverride: sched,
    liveEvents,
  });
  if (!result.ok) return result;

  const applied = result.career.fixtures.length > ready.fixtures.length;
  if (!applied) {
    return matchApplyFail(
      ready,
      "Instant simulation did not record a match result."
    );
  }

  return result;
}

export function getSquadStrengthPreview(career: ManagerCareer): number {
  return computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
}
