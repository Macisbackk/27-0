import { getPlayerById } from "../players";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import type { ManagerCareer, ManagerSeasonSummary, SeasonHighlightResult } from "./types";
import { buildManagerSchedule, buildLeagueTableFromMatches } from "./managerFixtures";
import { generateTransferMarket } from "./managerTransfers";
import { generateLeagueListedPlayers } from "./managerTransferLeague";
import { getUserLeaguePosition } from "./managerFixtures";
import { EMPTY_TEAM_SEASON_STATS } from "./managerCareerStats";
import {
  countExpiringContracts,
  formatWage,
  previewPlayersLeaving,
  tickContractsForNewSeason,
} from "./managerContracts";
import { createManagerChallengeCup } from "./managerChallengeCup";
import { userQualifiedForManagerPlayoffs } from "./managerPlayoffs";
import { initPreSeasonState } from "./managerFriendlies";
import {
  applyClubRevenue,
  computeSeasonTransferBudget,
  initManagerFinance,
  refreshClubFundsForSeason,
} from "./managerFinance";
import { addContractLeavingInboxMessage, clearSeasonTransferState } from "./managerInbox";
import { createClubAttendanceData } from "./managerAttendance";
import {
  applyYearlyYouthIntake,
  tickReserveContractsForNewSeason,
} from "./managerReserveContracts";
import {
  applyAiYouthIntakeToLeague,
  ensureLeagueClubRosters,
  reconcileLeagueRosters,
} from "./managerLeagueRosters";
import { initLeagueClubStates } from "./managerLeagueState";
import { snapshotSquadSeasonStartRatings } from "./managerPlayerDevelopment";
import {
  addPlayersToFreeAgents,
  simulateAiContractExpiries,
} from "./managerFreeAgents";
import {
  applySeasonRetirements,
  applyLeagueRetirements,
  tickClubCareerTotals,
} from "./managerRetirement";

import { writeManagerCareerRaw } from "./managerSaveStorage";

function persistCareer(career: ManagerCareer): void {
  writeManagerCareerRaw(career);
}

export function buildSeasonSummary(career: ManagerCareer): ManagerSeasonSummary {
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  let bestPlayerId: string | null = null;
  let bestRating = 0;
  let topTryScorerId: string | null = null;
  let topTries = 0;

  for (const ps of career.squad) {
    const player = getPlayerById(ps.playerId);
    if (!player) continue;
    if ((player.rating ?? player.peakRating) > bestRating) {
      bestRating = player.rating ?? player.peakRating;
      bestPlayerId = ps.playerId;
    }
    if (ps.seasonTries > topTries) {
      topTries = ps.seasonTries;
      topTryScorerId = ps.playerId;
    }
  }

  const trophies: string[] = [];
  const playoffFinish = career.playoffs?.finish ?? null;
  if (playoffFinish === "Super League Champions") {
    trophies.push("Super League Champions");
  } else if (position === 1) {
    trophies.push("League Leaders");
  }
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  if (cupOutcome.isWinner) trophies.push("Challenge Cup");
  if (playoffFinish === "Grand Final Runner-Up") {
    trophies.push("Grand Final Runner-Up");
  }

  let budgetChange = 0;
  if (playoffFinish === "Super League Champions") budgetChange = 600_000;
  else if (position === 1) budgetChange = 350_000;
  else if (position <= 4) budgetChange = 200_000;
  else if (position <= 8) budgetChange = 75_000;
  else budgetChange = 25_000;
  if (cupOutcome.isWinner) budgetChange += 150_000;
  if (playoffFinish === "Grand Final Runner-Up") budgetChange += 120_000;

  let boardVerdict = "A steady season — the board want more next year.";
  if (playoffFinish === "Super League Champions") {
    boardVerdict = "Outstanding — you delivered the title.";
  } else if (playoffFinish === "Grand Final Runner-Up") {
    boardVerdict = "So close — runners-up in the Grand Final.";
  } else if (userQualifiedForManagerPlayoffs(career) && position <= 6) {
    boardVerdict = "Playoff football achieved. Well done.";
  } else if (position >= 12) {
    boardVerdict = "Disappointing — improvements required.";
  }

  const sa = career.seasonAttendance;
  const avgAttendance =
    sa.count > 0 ? Math.round(sa.total / sa.count) : career.attendanceData.currentAverageAttendance;

  const expiring = countExpiringContracts(career.contracts);
  const leaving = previewPlayersLeaving(career);

  let biggestWin: SeasonHighlightResult | null = null;
  let biggestDefeat: SeasonHighlightResult | null = null;
  for (const f of career.fixtures) {
    const margin = f.pointsFor - f.pointsAgainst;
    if (f.result === "W" && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = {
        opponent: f.opponent,
        pointsFor: f.pointsFor,
        pointsAgainst: f.pointsAgainst,
        margin,
      };
    }
    if (f.result === "L" && (!biggestDefeat || margin < biggestDefeat.margin)) {
      biggestDefeat = {
        opponent: f.opponent,
        pointsFor: f.pointsFor,
        pointsAgainst: f.pointsAgainst,
        margin,
      };
    }
  }

  let seasonVerdict = boardVerdict;
  if (cupOutcome.isWinner) seasonVerdict = "A trophy-winning campaign.";
  else if (position <= 4 && !cupOutcome.isWinner) {
    seasonVerdict = "Strong league finish — cup disappointment.";
  }

  return {
    seasonYear: career.seasonYear,
    position,
    wins: career.wins,
    losses: career.losses,
    pointsFor: career.teamSeasonStats.pointsFor,
    pointsAgainst: career.teamSeasonStats.pointsAgainst,
    pointsDifference: career.teamSeasonStats.pointsDifference,
    boardVerdict,
    budgetChange,
    trophies,
    bestPlayerId,
    topTryScorerId,
    topTryScorerTries: topTries,
    challengeCupResult: cupOutcome.label,
    playoffFinish,
    biggestWin,
    biggestDefeat,
    averageAttendance: avgAttendance,
    highestAttendance: sa.high,
    lowestAttendance: sa.count > 0 ? sa.low : 0,
    finalFanMood: career.attendanceData.fanMood,
    wageBill: career.wageBill,
    expiringContracts: expiring,
    playersLeaving: leaving.map(
      (id) => getPlayerById(id)?.name ?? id
    ),
    seasonVerdict,
  };
}

export function advanceToNextSeason(career: ManagerCareer): ManagerCareer {
  const summary = buildSeasonSummary(career);
  const withTotals = tickClubCareerTotals(career);
  const { career: afterRetirements } = applySeasonRetirements(withTotals);
  const afterLeagueRetirements = applyLeagueRetirements(afterRetirements);
  const { career: afterSquadContracts, leaving: squadLeaving } =
    tickContractsForNewSeason(afterLeagueRetirements);
  const { career: afterReserveContracts, leaving: reserveLeaving } =
    tickReserveContractsForNewSeason(afterSquadContracts);

  let withInbox = afterReserveContracts;
  for (const playerId of squadLeaving) {
    const name = getPlayerById(playerId)?.name ?? playerId;
    withInbox = addContractLeavingInboxMessage(withInbox, playerId, name);
  }
  for (const reserveId of reserveLeaving) {
    const name =
      career.reserves.find((r) => r.id === reserveId)?.name ?? reserveId;
    withInbox = addContractLeavingInboxMessage(withInbox, reserveId, name);
  }

  const withFreeAgents = addPlayersToFreeAgents(
    withInbox,
    squadLeaving.map((playerId) => ({
      playerId,
      formerClub: career.club,
    })),
    career.seasonYear + 1
  );

  const clearedTransfers = clearSeasonTransferState(withFreeAgents);

  const leaving = [...squadLeaving, ...reserveLeaving];

  let boardConfidence = clearedTransfers.boardConfidence;
  if (leaving.length >= 3) boardConfidence = Math.max(0, boardConfidence - 10);
  else if (leaving.length > 0) boardConfidence = Math.max(0, boardConfidence - 4);

  const newSeed = `${career.seed}-s${career.seasonYear + 1}`;

  const prevFinance = afterReserveContracts.managerFinance;
  const transferBudget = computeSeasonTransferBudget(
    career.club,
    newSeed,
    career.seasonYear + 1,
    summary,
    prevFinance
  );

  const carriedOperating =
    afterReserveContracts.managerFinance?.operatingBalance ?? 0;

  const next: ManagerCareer = {
    ...clearedTransfers,
    seasonYear: career.seasonYear + 1,
    seed: newSeed,
    budget: transferBudget,
    clubFundsEarned: afterReserveContracts.clubFundsEarned,
    boardConfidence: Math.min(85, boardConfidence + 10),
    schedule: buildManagerSchedule(career.club, newSeed),
    fixtures: [],
    roundMatches: [],
    gameWeek: 0,
    currentFixtureIndex: 0,
    currentRound: 0,
    wins: 0,
    losses: 0,
    teamSeasonStats: { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: {},
    recentForm: [],
    isSeasonComplete: false,
    seasonHistory: [...career.seasonHistory, summary],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    gateIncomeHistory: [],
    attendanceData: createClubAttendanceData(career.club),
    seasonAttendance: { total: 0, count: 0, high: 0, low: 0 },
    challengeCup: createManagerChallengeCup(newSeed, career.club),
    playoffs: undefined,
    playoffsIntroAcknowledged: false,
    trophyCelebrationShown: false,
    leagueWinnersCelebrationShown: false,
    challengeCupCelebrationShown: false,
    wagePressureWeeks: 0,
    transferMarket: generateTransferMarket(withFreeAgents, newSeed, 0),
    squad: withFreeAgents.squad.map((p) => ({
      ...p,
      seasonAppearances: 0,
      seasonTries: 0,
      fitness: Math.min(100, p.fitness + 20),
    })),
    reserves: afterReserveContracts.reserves.map((r) => ({
      ...r,
      age: r.age + 1,
      baseRating: r.rating,
      reserveAppearances: 0,
      reserveTries: 0,
      calledUpForNextMatch: false,
    })),
    calledUpReserveIds: [],
    reserveResults: [],
    lastReserveResult: null,
    leagueTable: buildLeagueTableFromMatches([], career.club),
    preSeason: initPreSeasonState({}),
    managerFinance: {
      transferBudget,
      operatingBalance: carriedOperating,
      wageBudget: afterReserveContracts.wageBudget,
      wageBill: afterReserveContracts.wageBill,
      clubFunds: transferBudget + carriedOperating,
      seasonIncome: 0,
      seasonTransferIncome: 0,
      seasonOperatingIncome: 0,
      seasonSpending: 0,
    },
    latestNews: [],
    leagueTransfers: [],
    playerDevelopment: afterReserveContracts.playerDevelopment,
    lastSeasonDevelopmentReview: undefined,
    lastReserveReportWeek: undefined,
    leagueClubStates: initLeagueClubStates(),
    leagueClubStatesWeek: 0,
    clubFunds: refreshClubFundsForSeason(afterReserveContracts, summary),
    updatedAt: new Date().toISOString(),
  };

  const withIntake = simulateAiContractExpiries(
    applyYearlyYouthIntake(
      applyAiYouthIntakeToLeague(
        ensureLeagueClubRosters(reconcileLeagueRosters(next))
      )
    )
  );
  const seasonListed = generateLeagueListedPlayers(withIntake, newSeed, 0);
  let finalCareer: ManagerCareer = {
    ...withIntake,
    leagueListedPlayers: seasonListed,
    transferMarket: seasonListed.map((l) => l.playerId),
    playerDevelopment: snapshotSquadSeasonStartRatings(withIntake),
  };
  if (summary.budgetChange > 0) {
    finalCareer = applyClubRevenue(
      finalCareer,
      summary.budgetChange,
      "board_grant"
    );
  }
  persistCareer(finalCareer);
  return finalCareer;
}
