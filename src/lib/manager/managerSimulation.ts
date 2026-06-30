import { getPlayerById } from "../players";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { simulateOneFixture } from "../game/season-simulation";
import type { ManagerCareer, ManagerFixtureRecord } from "./types";
import {
  buildSquadSlotsFromMatchday,
  tickInjuries,
} from "./managerSquad";
import {
  simulateRoundOtherMatches,
  buildLeagueTableFromMatches,
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
  getNextManagerFixture,
  isManagerSeasonComplete,
} from "./managerChallengeCup";
import { countExpiringContracts } from "./managerContracts";
import { ensureManagerFixtureScoring, applyLiveEventsToFixtureScoring } from "./managerFixtureScoring";
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
): { avgForm: number; fitnessPenalty: number } {
  let formSum = 0;
  let fitnessPenalty = 0;
  let count = 0;
  for (const id of playerIds) {
    const ps = career.squad.find((p) => p.playerId === id);
    if (!ps) continue;
    formSum += ps.form;
    count++;
    if (ps.fitness < 70) fitnessPenalty += (70 - ps.fitness) * 0.04;
    if (ps.form < 35) fitnessPenalty += 0.3;
    if (ps.injury && !ps.injury.serious) fitnessPenalty += 1.5;
  }
  return {
    avgForm: count ? formSum / count : 50,
    fitnessPenalty,
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
  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const mods = getTacticModifiers(career.tactics);

  if (options.liveEvents?.length) {
    applyLiveEventsToFixtureScoring(career, fixture, options.liveEvents);
  } else {
    enrichManagerFixtureScoring(squad, fixture, career.seed, career.tactics, {
      currentSeasonOnly: true,
    });
  }
  ensureManagerFixtureScoring(career, fixture, squad);

  const motmId = pickMotmPlayerId(fixture, career.matchdayXiii);
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

  if (!isCup) {
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
        userMatch
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
    let fitness = ps.fitness;

    if (played) {
      fitness = Math.max(40, fitness - 8 * mods.fatigueFactor);
      if (won) {
        form = Math.min(99, form + 3);
      } else {
        form = Math.max(1, form - 2);
      }
    } else {
      fitness = Math.min(100, fitness + 5);
    }

    const inj = injuries.find((i) => i.playerId === ps.playerId);
    return {
      ...ps,
      form,
      fitness,
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
  }

  const record: ManagerFixtureRecord = {
    ...fixture,
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

  if (career.wageBill > career.wageBudget) {
    boardConfidence = Math.max(0, boardConfidence - 2);
  }
  const expiring = countExpiringContracts(career.contracts);
  if (expiring >= 4) boardConfidence = Math.max(0, boardConfidence - 3);

  const matchIncome = won ? 25_000 : 10_000;
  const cupBonus = isCup && won ? 50_000 : 0;

  const nextFixtureIndex = isCup
    ? career.currentFixtureIndex
    : career.currentFixtureIndex + 1;

  const nextCareer: ManagerCareer = {
    ...working,
    fixtures: [...career.fixtures, record],
    roundMatches: roundResults,
    leagueTable,
    currentRound: round,
    gameWeek: isCup ? career.gameWeek : round,
    currentFixtureIndex: nextFixtureIndex,
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
    budget: working.budget + matchIncome + cupBonus,
    clubFundsEarned: working.clubFundsEarned + matchIncome + cupBonus,
    boardConfidence,
    teamSeasonStats: statsUpdate.teamSeasonStats,
    playerSeasonStats: statsUpdate.playerSeasonStats,
    recentForm: statsUpdate.recentForm,
    isSeasonComplete: false,
    lastMatchFixture: record,
    challengeCup,
    updatedAt: new Date().toISOString(),
  };

  let finalCareer: ManagerCareer = {
    ...nextCareer,
    isSeasonComplete: isManagerSeasonComplete(nextCareer),
  };

  const reserveOpp = getReserveOpponent(sched.opponent, round, career.seed);
  const reserveResult = simulateReserveFixture(finalCareer, round, reserveOpp);
  finalCareer = applyReserveMatchDevelopment(finalCareer, reserveResult);
  finalCareer = clearReserveCallUps(finalCareer);
  finalCareer = generateIncomingTransferOffers(finalCareer);
  if (finalCareer.gameWeek % 3 === 0) {
    finalCareer = {
      ...finalCareer,
      leagueListedPlayers: generateLeagueListedPlayers(
        finalCareer.club,
        finalCareer.seed,
        finalCareer.gameWeek
      ),
      transferMarket: generateLeagueListedPlayers(
        finalCareer.club,
        finalCareer.seed,
        finalCareer.gameWeek
      ).map((l) => l.playerId),
    };
  }

  return finalCareer;
}

export function simulateManagerNextMatch(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) return career;

  const sched = getNextManagerFixture(career);
  if (!sched) return career;

  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const mods = getTacticModifiers(career.tactics);
  const { avgForm, fitnessPenalty } = computePlayerModifiers(career, [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]);

  const teamForm = Math.max(-10, Math.min(10, (avgForm - 50) / 5));
  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const baseOppRating = getOpponentMatchRating(
    sched.opponent,
    career.seed,
    round,
    { currentSeasonOnly: true }
  );
  const ratingDiff = userRating - baseOppRating;
  const opponentRating =
    baseOppRating +
    mods.opponentPenalty +
    fitnessPenalty * 0.3 -
    ratingDiff * 0.28;
  const userRatingBoost = mods.strengthBonus - fitnessPenalty * 0.2;

  const combinedForm = Math.max(
    -10,
    Math.min(10, teamForm + career.matchSimState.form * 0.4)
  );

  const { fixture, state: nextSimState } = simulateOneFixture(
    squad,
    sched.opponent,
    sched.isHome,
    round,
    career.seed,
    {
      form: combinedForm,
      seasonDropGoals: career.matchSimState.seasonDropGoals,
    },
    {
      currentSeasonOnly: true,
      opponentRatingOverride: opponentRating - userRatingBoost,
    }
  );

  const next = applyManagerMatchResult(career, fixture, { schedOverride: sched });
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

export { getNextManagerFixture };
