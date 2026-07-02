import { getPlayerById } from "../players";
import { getManagerPlayer } from "./managerPlayers";
import { getManagerOpponentPoolOptions } from "./managerLeagueRosters";
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
} from "./managerFixtures";
import { rollPostMatchInjuries } from "./managerTransfers";
import { computeManagerTeamRating } from "./managerRating";
import {
  enrichManagerFixtureScoring,
  pickMotmPlayerId,
} from "./managerScoring";
import {
  buildTacticEffectivenessLine,
  countTriesByPositionGroup,
} from "./managerTacticsScoring";
import { updateStatsAfterMatch } from "./managerCareerStats";
import type { MatchFixture } from "../game/season-simulation";
import { processHomeMatchAttendance } from "./managerAttendance";
import {
  applyCupMatchToBracket,
  ensureCupBracketReady,
  advanceCupBracketAfterUserMatch,
  getNextLeagueOrCupFixture,
  isLeagueAndCupPhaseComplete,
} from "./managerChallengeCup";
import {
  applyPlayoffMatchToBracket,
  buildPlayoffScheduledFixture,
  ensurePlayoffsReady,
  getUserPlayoffMatch,
  isPlayoffsPhaseComplete,
  preparePlayoffRound,
} from "./managerPlayoffs";

export function getNextManagerFixture(
  career: ManagerCareer
): ReturnType<typeof getNextLeagueOrCupFixture> {
  if (career.isSeasonComplete) return null;

  const leagueOrCup = getNextLeagueOrCupFixture(career);
  if (leagueOrCup) return leagueOrCup;

  if (!isLeagueAndCupPhaseComplete(career)) return null;

  const withPlayoffs = ensurePlayoffsReady(career);
  if (isPlayoffsPhaseComplete(withPlayoffs)) return null;

  const prepared = preparePlayoffRound(withPlayoffs);
  const playoffMatch = getUserPlayoffMatch(prepared);
  if (!playoffMatch) return null;

  return buildPlayoffScheduledFixture(
    { ...withPlayoffs, playoffs: prepared },
    playoffMatch
  );
}

export function isManagerSeasonComplete(career: ManagerCareer): boolean {
  if (!isLeagueAndCupPhaseComplete(career)) return false;
  return isPlayoffsPhaseComplete(ensurePlayoffsReady(career));
}
import { countExpiringContracts } from "./managerContracts";
import { maybeGenerateAiTransfers } from "./managerAiTransfers";
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
  clearReserveCallUps,
  getReserveOpponent,
  simulateReserveFixture,
} from "./managerReserves";
import {
  generateIncomingTransferOffers,
  generateLeagueListedPlayers,
} from "./managerTransferLeague";
import { syncManagerInboxMessages } from "./managerInbox";
import { completeFriendlyMatch } from "./managerFriendlies";
import { maybeAddReserveReport } from "./managerReserveReports";
import { rotateLatestNews } from "./managerNews";
import {
  generateManagerMatchBio,
} from "./manager-match-summary";
import { syncManagerFinance } from "./managerFinance";

interface TacticModifiers {
  strengthBonus: number;
  opponentPenalty: number;
  errorRisk: number;
  fatigueFactor: number;
  tacticLine: string;
}

export function getTacticModifiers(
  tactics: ManagerCareer["tactics"]
): TacticModifiers {
  let strengthBonus = 0;
  let opponentPenalty = 0;
  let errorRisk = 0;
  let fatigueFactor = 1;
  const lines: string[] = [];

  switch (tactics.playingStyle) {
    case "expansive":
      strengthBonus += 2;
      errorRisk += 0.15;
      lines.push("expansive style created edge chances");
      break;
    case "direct":
      strengthBonus += 1.5;
      lines.push("direct approach through the pack");
      break;
    case "defensive":
      strengthBonus -= 1;
      opponentPenalty -= 2;
      lines.push("defensive shape kept the score tight");
      break;
    case "high_tempo":
      strengthBonus += 1;
      opponentPenalty += 1;
      fatigueFactor = 1.35;
      lines.push("high tempo opened the game up");
      break;
    default:
      break;
  }

  switch (tactics.attackFocus) {
    case "kicking_game":
      strengthBonus += 1;
      break;
    case "safe_sets":
      errorRisk -= 0.1;
      break;
    default:
      break;
  }

  switch (tactics.defenceFocus) {
    case "line_speed":
      opponentPenalty -= 1;
      break;
    case "aggressive_contact":
      opponentPenalty -= 0.5;
      fatigueFactor += 0.15;
      break;
    case "conservative":
      opponentPenalty -= 1.5;
      strengthBonus -= 0.5;
      break;
    default:
      break;
  }

  const tacticLine =
    lines.length > 0
      ? `Your ${lines[0]}${errorRisk > 0.1 ? ", but errors crept in" : fatigueFactor > 1.2 ? ", though fatigue showed late on" : "."}`
      : "A balanced game plan from the coaching box.";

  return {
    strengthBonus,
    opponentPenalty,
    errorRisk,
    fatigueFactor,
    tacticLine,
  };
}

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
export function applyManagerMatchResult(
  career: ManagerCareer,
  fixture: MatchFixture,
  options: {
    playedLive?: boolean;
    schedOverride?: ReturnType<typeof getNextManagerFixture>;
    liveEvents?: import("./types").LiveMatchEvent[];
  } = {}
): ManagerCareer {
  const sched =
    options.schedOverride ?? getNextManagerFixture(career);
  if (!sched) return career;

  const isCup = sched.competition === "challenge_cup";
  const isPlayoff = sched.competition === "playoffs";
  const isFriendly = sched.competition === "friendly";
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

  const motmId = pickMotmPlayerId(fixture, [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]);
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
    back
  );

  const won = fixture.result === "W";

  let roundResults = career.roundMatches;
  let leagueTable = career.leagueTable;
  let leagueStates = resolveLeagueClubStatesForFixture(
    career,
    !isCup && !isFriendly && !isPlayoff ? round : career.gameWeek || round
  );

  if (!isCup && !isFriendly && !isPlayoff) {
    const userMatch = {
      round,
      homeTeam: sched.isHome ? career.club : sched.opponent,
      awayTeam: sched.isHome ? sched.opponent : career.club,
      homeScore: sched.isHome ? fixture.pointsFor : fixture.pointsAgainst,
      awayScore: sched.isHome ? fixture.pointsAgainst : fixture.pointsFor,
      homeTries: sched.isHome ? fixture.triesFor : fixture.triesAgainst,
      awayTries: sched.isHome ? fixture.triesAgainst : fixture.triesFor,
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

  let nextSquad = tickInjuries(career.squad).map((ps) => {
    const matchdayIds = new Set([
      ...career.matchdayXiii.filter(Boolean),
      ...career.matchdayInterchange.filter(Boolean),
    ]);
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

  const matchdayIds = [
    ...career.matchdayXiii.filter(Boolean),
    ...career.matchdayInterchange.filter(Boolean),
  ];
  const statsUpdate = updateStatsAfterMatch(
    career,
    fixture,
    squad,
    matchdayIds,
    motmId
  );
  const teamSeasonStats = isFriendly
    ? career.teamSeasonStats
    : statsUpdate.teamSeasonStats;
  const recentForm = statsUpdate.recentForm;

  let working: ManagerCareer = { ...career, squad: nextSquad };

  const { career: withAttendance, meta: attendanceMeta } =
    processHomeMatchAttendance(working, sched, fixture);
  working = withAttendance;

  let challengeCup = working.challengeCup;
  if (isCup && sched.cupMatchId) {
    challengeCup = applyCupMatchToBracket(
      working,
      sched.cupMatchId,
      fixture
    );
    working = { ...working, challengeCup };
    if (!challengeCup.userEliminated && !challengeCup.tournamentComplete) {
      challengeCup = advanceCupBracketAfterUserMatch(working);
      working = { ...working, challengeCup };
    }
  }

  let playoffs = working.playoffs;
  if (isPlayoff && sched.playoffMatchId) {
    playoffs = applyPlayoffMatchToBracket(
      working,
      sched.playoffMatchId,
      fixture
    );
    working = { ...working, playoffs };
  }

  const motmPlayer = motmId
    ? getManagerPlayer(career, motmId)
    : null;
  const fixtureWithMotm: MatchFixture = motmId && motmPlayer
    ? {
        ...fixture,
        manOfTheMatch: {
          playerId: motmId,
          playerName: motmPlayer.name,
          teamName: career.club,
          performanceSummary:
            (fixture.scoringDetail?.dreamTeam.tryScorers.find(
              (s) => s.playerId === motmId
            )?.tries ?? 0) >= 2
              ? "Outstanding try-scoring display"
              : "Standout performance",
        },
      }
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
      injuries: injuries.map((i) => ({
        ...i,
        name: getPlayerById(i.playerId)?.name ?? "Player",
      })),
      playerOfMatchId: motmId,
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

  const position = leagueTable.find((r) => r.isUserTeam)?.position ?? 14;

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

  const matchIncome = isFriendly
    ? won
      ? 8_000
      : 4_000
    : won
      ? 25_000
      : 10_000;
  const cupBonus = isCup && won ? 50_000 : 0;

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
    budget: working.budget + matchIncome + cupBonus,
    clubFundsEarned: working.clubFundsEarned + matchIncome + cupBonus,
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

  let finalCareer: ManagerCareer = ensurePlayoffsReady({
    ...nextCareer,
    isSeasonComplete: isManagerSeasonComplete(nextCareer),
  });
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
  finalCareer = applyReserveMatchDevelopment(finalCareer, reserveResult);
  finalCareer = clearReserveCallUps(finalCareer);
  finalCareer = generateIncomingTransferOffers(finalCareer);
  finalCareer = syncManagerInboxMessages(finalCareer);
  finalCareer = maybeAddReserveReport(finalCareer);
  finalCareer = rotateLatestNews(finalCareer);
  finalCareer = maybeGenerateAiTransfers(finalCareer);
  if (isFriendly) {
    finalCareer = completeFriendlyMatch(finalCareer);
  }
  finalCareer = syncManagerFinance(finalCareer);
  if (finalCareer.gameWeek % 3 === 0) {
    finalCareer = {
      ...finalCareer,
      leagueListedPlayers: generateLeagueListedPlayers(
        finalCareer,
        finalCareer.seed,
        finalCareer.gameWeek
      ),
      transferMarket: generateLeagueListedPlayers(
        finalCareer,
        finalCareer.seed,
        finalCareer.gameWeek
      ).map((l) => l.playerId),
    };
  }

  return finalCareer;
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
  const homeAdj = sched.isHome ? 5 : -1;
  const ratingGap = userRating - baseOppRating + homeAdj;
  const formFromRatings = Math.max(-3, Math.min(7, ratingGap * 0.4));
  const combinedForm = Math.max(
    -2,
    Math.min(
      8,
      teamForm + simCareer.matchSimState.form * 0.12 + formFromRatings
    )
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
    sched.isHome,
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

export function simulateManagerNextMatch(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) return career;

  const simCareer = resolveCareerForMatchSimulation(career);
  const ready = ensureCupBracketReady(simCareer);
  const sched = getNextManagerFixture(ready);
  if (!sched) return career;

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

  const next = applyManagerMatchResult(ready, fixture, {
    schedOverride: sched,
    liveEvents,
  });
  return {
    ...next,
    matchSimState: nextSimState,
  };
}

export function getSquadStrengthPreview(career: ManagerCareer): number {
  return computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
}
