import { getOpponentMatchRating } from "../game/opponent-scorers";
import { simulateOneFixture } from "../game/season-simulation";
import { getPlayerById } from "../players";
import type { ManagerCareer, ManagerFixtureRecord } from "./types";
import { MANAGER_SEASON_GAMES } from "./types";
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

  switch (tactics.riskLevel) {
    case "low":
      errorRisk -= 0.12;
      strengthBonus -= 0.5;
      break;
    case "high":
      errorRisk += 0.2;
      strengthBonus += 1.5;
      opponentPenalty += 1;
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
    if (ps.morale < 40) fitnessPenalty += 0.5;
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
  options: { playedLive?: boolean } = {}
): ManagerCareer {
  const sched = career.schedule.find((s) => s.round === fixture.round);
  if (!sched) return career;

  const round = fixture.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions
  );
  const mods = getTacticModifiers(career.tactics);

  enrichManagerFixtureScoring(squad, fixture, career.seed, career.tactics, {
    currentSeasonOnly: true,
  });

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
  const userMatch = {
    round,
    homeTeam: sched.isHome ? career.club : sched.opponent,
    awayTeam: sched.isHome ? sched.opponent : career.club,
    homeScore: sched.isHome ? fixture.pointsFor : fixture.pointsAgainst,
    awayScore: sched.isHome ? fixture.pointsAgainst : fixture.pointsFor,
    homeTries: sched.isHome ? fixture.triesFor : fixture.triesAgainst,
    awayTries: sched.isHome ? fixture.triesAgainst : fixture.triesFor,
  };

  const roundResults = simulateRoundOtherMatches(
    career.club,
    sched.opponent,
    round,
    career.seed,
    userMatch
  );

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
    const played = career.matchdayXiii.includes(ps.playerId);
    const tryCount =
      fixture.scoringDetail?.dreamTeam.tryScorers.find(
        (t) => t.playerId === ps.playerId
      )?.tries ?? 0;

    let form = ps.form;
    let morale = ps.morale;
    let fitness = ps.fitness;

    if (played) {
      fitness = Math.max(40, fitness - 8 * mods.fatigueFactor);
      if (won) {
        form = Math.min(99, form + 3);
        morale = Math.min(99, morale + 2);
      } else {
        form = Math.max(1, form - 2);
        morale = Math.max(1, morale - 3);
      }
    } else {
      fitness = Math.min(100, fitness + 5);
    }

    const inj = injuries.find((i) => i.playerId === ps.playerId);
    return {
      ...ps,
      form,
      morale,
      fitness,
      injury: inj?.injury ?? ps.injury,
      seasonAppearances: played ? ps.seasonAppearances + 1 : ps.seasonAppearances,
      seasonTries: ps.seasonTries + tryCount,
    };
  });

  const statsUpdate = updateStatsAfterMatch(
    career,
    fixture,
    squad,
    career.matchdayXiii,
    motmId
  );

  const record: ManagerFixtureRecord = {
    ...fixture,
    userClub: career.club,
    meta: {
      tacticImpactLine: mods.tacticLine,
      tacticEffectivenessLine: effectivenessLine,
      injuries: injuries.map((i) => ({
        ...i,
        name: getPlayerById(i.playerId)?.name ?? "Player",
      })),
      playerOfMatchId: motmId,
      playedLive: options.playedLive ?? false,
    },
  };

  const allMatches = [...career.roundMatches, ...roundResults];
  const leagueTable = buildLeagueTableFromMatches(allMatches, career.club);
  const position = leagueTable.find((r) => r.isUserTeam)?.position ?? 14;

  let boardConfidence = career.boardConfidence;
  if (won) boardConfidence = Math.min(100, boardConfidence + 3);
  else boardConfidence = Math.max(0, boardConfidence - 4);
  if (position <= 4) boardConfidence = Math.min(100, boardConfidence + 1);
  if (position >= 12) boardConfidence = Math.max(0, boardConfidence - 2);

  const matchIncome = won ? 25_000 : 10_000;
  const isComplete = round >= MANAGER_SEASON_GAMES;

  return {
    ...career,
    squad: nextSquad,
    fixtures: [...career.fixtures, record],
    roundMatches: allMatches,
    leagueTable,
    currentRound: round,
    gameWeek: round,
    currentFixtureIndex: round,
    matchSimState: career.matchSimState,
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
    budget: career.budget + matchIncome,
    clubFundsEarned: career.clubFundsEarned + matchIncome,
    boardConfidence,
    teamSeasonStats: statsUpdate.teamSeasonStats,
    playerSeasonStats: statsUpdate.playerSeasonStats,
    recentForm: statsUpdate.recentForm,
    isSeasonComplete: isComplete,
    lastMatchFixture: record,
    updatedAt: new Date().toISOString(),
  };
}

export function simulateManagerNextMatch(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete || career.currentRound >= MANAGER_SEASON_GAMES) {
    return career;
  }

  const sched = career.schedule[career.currentRound];
  if (!sched) return career;

  const round = sched.round;
  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions
  );
  const mods = getTacticModifiers(career.tactics);
  const { avgForm, fitnessPenalty } = computePlayerModifiers(career, [
    ...career.matchdayXiii,
    ...career.matchdayInterchange,
  ]);

  const teamForm = Math.max(-10, Math.min(10, (avgForm - 50) / 5));
  const baseOppRating = getOpponentMatchRating(
    sched.opponent,
    career.seed,
    round,
    { currentSeasonOnly: true }
  );
  const opponentRating =
    baseOppRating + mods.opponentPenalty + fitnessPenalty * 0.3;
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

  const next = applyManagerMatchResult(career, fixture);
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
