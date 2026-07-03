import { getPlayerById } from "../players";
import { getManagerPlayer } from "./managerPlayers";
import { getManagerOpponentPoolOptions, pruneLeagueListedPlayers } from "./managerLeagueRosters";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { simulateOneFixture } from "../game/season-simulation";
import type { ManagerCareer, ManagerFixtureRecord } from "./types";
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
import { getLeagueFixtureSides, isMagicWeekendFixture } from "./managerMagicWeekend";
import { rollPostMatchInjuries } from "./managerTransfers";
import { computeManagerTeamRating } from "./managerRating";
import {
  enrichManagerFixtureScoring,
} from "./managerScoring";
import {
  buildTacticEffectivenessLine,
  buildTacticMatchReviewAdvice,
  countTriesByPositionGroup,
  applyTacticFormAdjustment,
  getTacticModifiers,
} from "./managerTacticsScoring";
import { updateStatsAfterMatch } from "./managerCareerStats";
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
  getUserPlayoffMatch,
  isPlayoffMatchReadyForResult,
  isPlayoffsPhaseComplete,
  preparePlayoffRound,
  userQualifiedForManagerPlayoffs,
} from "./managerPlayoffs";

export function getNextManagerFixture(
  career: ManagerCareer
): ReturnType<typeof getNextLeagueOrCupFixture> {
  const synced = syncManagerLeagueTable(career);

  const leagueOrCup = getNextLeagueOrCupFixture(synced);
  if (leagueOrCup) return leagueOrCup;

  if (!isLeagueAndCupPhaseComplete(synced)) return null;

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
  if (!userQualifiedForManagerPlayoffs(synced)) return true;
  if (!synced.playoffsIntroAcknowledged) return false;
  const playoffs = synced.playoffs;
  if (!playoffs) return false;
  return isPlayoffsPhaseComplete({ ...synced, playoffs });
}

export function isManagerSeasonComplete(career: ManagerCareer): boolean {
  const synced = syncManagerLeagueTable(career);
  if (!isLeagueAndCupPhaseComplete(synced)) return false;
  const withPlayoffs = ensurePlayoffsReady(synced);
  return isPlayoffsPhaseComplete(withPlayoffs);
}

/** Squad + cup/playoff bracket prep before resolving or playing the next fixture. */
export function prepareCareerForNextMatch(career: ManagerCareer): ManagerCareer {
  const simulated = resolveCareerForMatchSimulation(career);
  return ensurePlayoffsReady(ensureCupBracketReady(simulated));
}

import { countExpiringContracts } from "./managerContracts";
import { maybeGenerateAiTransfers } from "./managerAiTransfers";
import { maybeAiSignFreeAgents } from "./managerFreeAgents";
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
} from "./managerReserves";
import {
  generateIncomingTransferOffers,
  generateUnsolicitedTransferOffers,
  generateLeagueListedPlayers,
} from "./managerTransferLeague";
import { syncManagerInboxMessages } from "./managerInbox";
import { completeFriendlyMatch } from "./managerFriendlies";
import { maybeAddReserveReport } from "./managerReserveReports";
import { rotateLatestNews } from "./managerNews";
import {
  generateManagerMatchBio,
  selectManagerManOfTheMatch,
} from "./manager-match-summary";
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
      const fitnessWeight = Math.max(0.8, ps.fitness / 100);
      formSum += ps.form * fitnessWeight;
      count++;
      continue;
    }
    const reserve = career.reserves.find((r) => r.id === id);
    if (reserve) {
      const fitnessWeight = Math.max(0.8, reserve.fitness / 100);
      formSum += reserve.form * fitnessWeight;
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
  const sched =
    options.schedOverride ?? getNextManagerFixture(career);
  if (!sched) {
    return matchApplyFail(career, "No fixture is scheduled.");
  }

  const isCup = sched.competition === "challenge_cup";
  const isPlayoff = sched.competition === "playoffs";
  const isFriendly = sched.competition === "friendly";

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

  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const mods = getTacticModifiers(career.tactics);

  if (options.liveEvents?.length) {
    applyLiveEventsToFixtureScoring(
      career,
      fixture,
      options.liveEvents,
      sched.id
    );
    const eventTryTotal =
      fixture.scoringDetail?.dreamTeam.tryScorers.reduce(
        (sum, t) => sum + t.tries,
        0
      ) ?? 0;
    if (eventTryTotal !== fixture.triesFor) {
      enrichManagerFixtureScoring(squad, fixture, career.seed, career.tactics, {
        currentSeasonOnly: true,
        fixtureKey: sched.id,
        career,
      });
    }
  } else {
    enrichManagerFixtureScoring(squad, fixture, career.seed, career.tactics, {
      currentSeasonOnly: true,
      fixtureKey: sched.id,
      career,
    });
  }
  ensureManagerFixtureScoring(career, fixture, squad, sched.id);

  const matchdayIdList = [
    ...career.matchdayXiii.filter(Boolean),
    ...career.matchdayInterchange.filter(Boolean),
  ];
  const motm = selectManagerManOfTheMatch(
    fixture,
    career,
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
    career.tactics,
    fixture.result === "W",
    fixture.triesFor,
    fixture.triesAgainst,
    forward,
    back,
    fixture.scoringDetail?.opponent.tryScorers ?? []
  );
  const tacticReview = buildTacticMatchReviewAdvice(
    career.tactics,
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

  let roundResults = career.roundMatches;
  let leagueTable = career.leagueTable;
  let leagueStates = resolveLeagueClubStatesForFixture(
    career,
    !isCup && !isFriendly && !isPlayoff ? round : career.gameWeek || round
  );

  if (!isCup && !isFriendly && !isPlayoff) {
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

    roundResults = [
      ...career.roundMatches,
      ...simulateRoundOtherMatches(
        career.club,
        sched.opponent,
        round,
        career.seed,
        userMatch,
        leagueStates,
        career
      ),
    ];
    leagueTable = buildLeagueTableFromMatches(roundResults, career.club);
  }

  const aggressiveDefence =
    career.tactics.defenceFocus === "aggressive_contact";
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

    let form = ps.form;

    if (played) {
      if (won) {
        form = Math.min(99, form + 3);
      } else {
        form = Math.max(1, form - 2);
      }
    }

    const inj = injuries.find((i) => i.playerId === ps.playerId);
    return {
      ...ps,
      form,
      injury: inj?.injury ?? ps.injury,
      seasonAppearances: played ? ps.seasonAppearances + 1 : ps.seasonAppearances,
      seasonTries: ps.seasonTries + tryCount,
    };
  });

  const statsUpdate = updateStatsAfterMatch(
    career,
    fixture,
    squad,
    matchdayIdList,
    motmId
  );
  const teamSeasonStats = isFriendly
    ? career.teamSeasonStats
    : statsUpdate.teamSeasonStats;
  const recentForm = statsUpdate.recentForm;

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
    if (!playoffs.userEliminated && !playoffs.tournamentComplete) {
      playoffs = advancePlayoffBracketAfterUserMatch(working);
      working = { ...working, playoffs };
    }
  }

  const fixtureWithMotm: MatchFixture = motm
    ? { ...fixture, manOfTheMatch: motm }
    : fixture;

  const matchBio = generateManagerMatchBio(fixtureWithMotm, career.seed, {
    clubName: career.club,
    competition: sched.competition,
    cupRound: sched.cupRound,
    tacticImpactLine: mods.tacticLine,
    tacticEffectivenessLine: effectivenessLine,
    attendance: attendanceMeta ?? undefined,
    playedLive: options.playedLive ?? false,
    injuryCount: injuries.length,
    forwardTries: forward,
    backTries: back,
  });
  fixtureWithMotm.matchBio = matchBio;

  const record: ManagerFixtureRecord = {
    ...fixtureWithMotm,
    matchBio,
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
      playedLive: options.playedLive ?? false,
      attendance: attendanceMeta ?? undefined,
      competition: sched.competition,
      cupRound: sched.cupRound,
      liveEvents: options.liveEvents,
      matchdayXiii: [...career.matchdayXiii],
      matchdayInterchange: [...career.matchdayInterchange],
      xiiiSlotPositions: [...career.xiiiSlotPositions],
    },
  };

  const position = getUserLeaguePosition(leagueTable, career.club);

  let boardConfidence = career.boardConfidence;
  if (won) boardConfidence = Math.min(100, boardConfidence + 3);
  else boardConfidence = Math.max(0, boardConfidence - 4);
  if (position <= 4) boardConfidence = Math.min(100, boardConfidence + 1);
  if (position >= 12) boardConfidence = Math.max(0, boardConfidence - 2);
  if (isCup && won) boardConfidence = Math.min(100, boardConfidence + 5);
  if (isCup && !won) boardConfidence = Math.max(0, boardConfidence - 3);
  if (isPlayoff && won) boardConfidence = Math.min(100, boardConfidence + 6);
  if (isPlayoff && !won) boardConfidence = Math.max(0, boardConfidence - 5);

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
  const expiring = countExpiringContracts(career.contracts);
  if (expiring >= 4) boardConfidence = Math.max(0, boardConfidence - 3);

  const matchIncome = isMagicWeekendFixture(sched)
    ? 0
    : isFriendly
        ? won
          ? 4_000
          : 2_000
        : won
          ? 15_000
          : 6_000;
  const cupBonus = isCup && won ? 30_000 : 0;

  const nextFixtureIndex =
    isCup || isFriendly || isPlayoff
      ? career.currentFixtureIndex
      : career.currentFixtureIndex + 1;

  const nextCareer: ManagerCareer = {
    ...working,
    leagueClubStates: leagueStates,
    leagueClubStatesWeek:
      !isCup && !isFriendly && !isPlayoff
        ? round
        : career.leagueClubStatesWeek,
    fixtures: [...career.fixtures, record],
    roundMatches: roundResults,
    leagueTable,
    currentRound: isFriendly ? career.currentRound : round,
    gameWeek: isCup || isFriendly || isPlayoff ? career.gameWeek : round,
    currentFixtureIndex: nextFixtureIndex,
    wins:
      isFriendly || isCup || isPlayoff
        ? career.wins
        : career.wins + (won ? 1 : 0),
    losses:
      isFriendly || isCup || isPlayoff
        ? career.losses
        : career.losses + (won ? 0 : 1),
    boardConfidence,
    teamSeasonStats,
    playerSeasonStats: statsUpdate.playerSeasonStats,
    recentForm,
    isSeasonComplete: false,
    lastMatchFixture: record,
    challengeCup,
    playoffs,
    wagePressureWeeks,
    updatedAt: new Date().toISOString(),
  };

  let finalCareer: ManagerCareer = ensurePlayoffsReady(
    syncManagerLeagueTable(nextCareer)
  );
  if (matchIncome > 0) {
    finalCareer = applyClubRevenue(finalCareer, matchIncome, "match_fee");
  }
  if (cupBonus > 0) {
    finalCareer = applyClubRevenue(finalCareer, cupBonus, "cup_prize");
  }
  finalCareer = {
    ...finalCareer,
    isSeasonComplete: isManagerSeasonComplete(finalCareer),
  };

  if (finalCareer.isSeasonComplete && !finalCareer.lastSeasonDevelopmentReview) {
    const developed = developSquadAtSeasonEnd(finalCareer);
    finalCareer = {
      ...developed.career,
      isSeasonComplete: true,
      lastSeasonDevelopmentReview: developed.changes,
    };
  }

  const reserveOpp = getReserveOpponent(sched.opponent, round, career.seed);
  const reserveResult = simulateReserveFixture(finalCareer, round, reserveOpp);
  finalCareer = applyYouthMatchDevelopment(finalCareer, { round, matchdayIds });
  finalCareer = applyReserveMatchDevelopment(finalCareer, reserveResult);
  finalCareer = clearReserveCallUps(finalCareer);
  finalCareer = generateIncomingTransferOffers(finalCareer);
  if (!isFriendly) {
    finalCareer = generateUnsolicitedTransferOffers(finalCareer);
  }
  finalCareer = syncManagerInboxMessages(finalCareer);
  finalCareer = maybeAddReserveReport(finalCareer);
  finalCareer = rotateLatestNews(finalCareer);
  finalCareer = maybeGenerateAiTransfers(finalCareer);
  finalCareer = maybeAiSignFreeAgents(finalCareer);
  if (isFriendly) {
    finalCareer = completeFriendlyMatch(finalCareer);
  }
  finalCareer = syncManagerFinance(finalCareer);
  if (finalCareer.gameWeek % 3 === 0) {
    const refreshed = generateLeagueListedPlayers(
      finalCareer,
      finalCareer.seed,
      finalCareer.gameWeek
    );
    const listedIds = new Set(refreshed.map((l) => l.playerId));
    const preserved = finalCareer.leagueListedPlayers.filter(
      (l) => !listedIds.has(l.playerId)
    );
    const merged = [...preserved, ...refreshed];
    const deduped = Array.from(
      new Map(merged.map((l) => [l.playerId, l])).values()
    );
    finalCareer = {
      ...finalCareer,
      leagueListedPlayers: deduped,
      transferMarket: deduped.map((l) => l.playerId),
    };
  }

  return { ok: true, career: pruneLeagueListedPlayers(finalCareer) };
}

export function previewManagerMatchScoreline(
  career: ManagerCareer,
  sched: NonNullable<ReturnType<typeof getNextManagerFixture>>
): MatchFixture {
  const simCareer = resolveCareerForMatchSimulation(career);
  const isFriendly = sched.competition === "friendly";
  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    simCareer.matchdayXiii,
    simCareer.xiiiSlotPositions,
    simCareer
  );
  const mods = getTacticModifiers(simCareer.tactics);
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
  const friendlyRating = simCareer.preSeason.activeFriendly?.teamRating;
  const baseOppRating =
    isFriendly && friendlyRating
      ? friendlyRating
      : getOpponentMatchRating(
          sched.opponent,
          simCareer.seed,
          round,
          isFriendly
            ? { currentSeasonOnly: false }
            : getManagerOpponentPoolOptions(simCareer, sched.opponent)
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

  const strengthBias =
    userRating > baseOppRating
      ? Math.min(8, (userRating - baseOppRating) * 0.35)
      : 0;

  const opponentRating =
    baseOppRating +
    mods.opponentPenalty * 0.12 -
    mods.strengthBonus * 0.25 -
    strengthBias -
    opponentInjuryPenalty;

  const { fixture } = simulateOneFixture(
    squad,
    sched.opponent,
    sched.isNeutral ? false : sched.isHome,
    round,
    simCareer.seed,
    {
      form: combinedForm,
      seasonDropGoals: simCareer.matchSimState.seasonDropGoals,
    },
    {
      currentSeasonOnly: !isFriendly,
      opponentRatingOverride: opponentRating,
      userRatingOverride: userRating,
      cupMode: sched.competition === "challenge_cup",
      managerCareerMode: true,
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
  const fixture = previewManagerMatchScoreline(career, sched);
  return { fixture, liveEvents: [] };
}

export function simulateManagerNextMatch(
  career: ManagerCareer
): ManagerMatchApplyResult {
  if (isManagerSeasonComplete(career)) {
    return matchApplyFail(career, "The season is already complete.");
  }

  const ready = prepareCareerForNextMatch(career);
  const sched = getNextManagerFixture(ready);
  if (!sched) {
    return matchApplyFail(ready, "No fixture is scheduled.");
  }

  const { fixture, liveEvents } = simulateManagerMatchLive(ready, sched);
  const { avgForm } = computePlayerModifiers(ready, [
    ...ready.matchdayXiii,
    ...ready.matchdayInterchange,
  ]);
  const teamForm = Math.max(-10, Math.min(10, (avgForm - 50) / 5));
  const combinedForm = Math.max(
    -4,
    Math.min(8, teamForm + ready.matchSimState.form * 0.2)
  );
  const nextSimState = {
    form:
      fixture.result === "W"
        ? Math.min(8, combinedForm + 1.5)
        : Math.max(-4, combinedForm - 1.5),
    seasonDropGoals:
      ready.matchSimState.seasonDropGoals +
      (fixture.scoringFor?.dropGoals ?? 0) +
      (fixture.scoringAgainst?.dropGoals ?? 0),
  };

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

  return {
    ok: true,
    career: {
      ...result.career,
      matchSimState: nextSimState,
    },
  };
}

export function getSquadStrengthPreview(career: ManagerCareer): number {
  return computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
}
