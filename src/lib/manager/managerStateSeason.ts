import { getManagerPlayer } from "./managerPlayers";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import type { ManagerCareer, ManagerSeasonSummary, SeasonHighlightResult } from "./types";
import { buildManagerSchedule, buildLeagueTableFromMatches, getManagerLeagueTable, buildManagerScheduleFromChampionship } from "./managerFixtures";
import {
  applyPromotionRelegation,
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  getUserCompetitionId,
  getUserLeagueClubs,
  getUserSeasonGames,
  isUserInChampionship,
} from "./leagueMembership";
import { CHAMPIONSHIP_EXPECTATION_LABELS, expectationTierFromStars, getManagerClubConfig, MANAGER_EXPECTATION_LABELS } from "./club-config";
import { generateTransferMarket } from "./managerTransfers";
import { generateLeagueListedPlayers } from "./managerTransferLeague";
import { getUserLeagueTablePosition } from "./managerFixtures";
import { EMPTY_TEAM_SEASON_STATS } from "./managerCareerStats";
import {
  countExpiringContracts,
  formatWage,
  previewPlayersLeaving,
  tickContractsForNewSeason,
} from "./managerContracts";
import { createManagerChallengeCup } from "./managerChallengeCup";
import {
  CHALLENGE_CUP_SCHEMA_VERSION,
  standingsToCupSeeding,
} from "./championship/championshipChallengeCup";
import { userQualifiedForManagerPlayoffs } from "./managerPlayoffs";
import { initPreSeasonState } from "./managerFriendlies";
import {
  computeSeasonTransferBudget,
  resyncCareerEconomyToClubStars,
  initManagerFinance,
  refreshClubFundsForSeason,
} from "./managerFinance";
import { awardManagerSeasonBoardGrant } from "./managerSeasonRewards";
import { addContractLeavingInboxMessage, clearSeasonTransferState } from "./managerInbox";
import { returnExpiredLoans } from "./managerLoans";
import { createClubAttendanceData, applyAttendancePerformanceDrift } from "./managerAttendance";
import { applyAutoPromoteByRating, tickReserveYearsAtClub } from "./managerReserveRelease";
import { applySeasonAiReserveIntake, ensureAllClubReserveDepth } from "./managerReserves";
import {
  applyYearlyYouthIntake,
  tickReserveContractsForNewSeason,
} from "./managerReserveContracts";
import { simulateAiSeasonRosterActivity } from "./managerAiRosterEvolution";
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
import { getManagerSeasonTrophyLabels } from "./managerSeasonTrophies";
import { applySeasonClubPrestigeDrift, getCareerClubStars } from "./managerDifficulty";
import { getClubFacilities } from "./managerFacilities";
import { createChampionshipCompetition } from "./championship/championshipLeague";
import {
  resolveSeasonChampionForAdvance,
  scheduleWorldClubChallengeForSeason,
} from "./worldClubChallenge";
import { finalizePlayoffTournamentForChampion } from "./managerPlayoffs";
import { hydrateManagerPlayerRegistryAges } from "./managerPlayers";

export function buildSeasonSummary(career: ManagerCareer): ManagerSeasonSummary {
  const position = getUserLeagueTablePosition(career);
  let bestPlayerId: string | null = null;
  let bestRating = 0;
  let topTryScorerId: string | null = null;
  let topTries = 0;

  for (const ps of career.squad) {
    const player = getManagerPlayer(career, ps.playerId);
    if (!player) continue;
    if (player.peakRating > bestRating) {
      bestRating = player.peakRating;
      bestPlayerId = ps.playerId;
    }
    if (ps.seasonTries > topTries) {
      topTries = ps.seasonTries;
      topTryScorerId = ps.playerId;
    }
  }

  const trophies = getManagerSeasonTrophyLabels(career);
  const playoffFinish = career.playoffs?.finish ?? null;
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);

  let budgetChange = 0;
  if (playoffFinish === "Super League Champions") budgetChange = 600_000;
  else if (position === 1) budgetChange = 350_000;
  else if (position <= 4) budgetChange = 200_000;
  else if (position <= 8) budgetChange = 75_000;
  else budgetChange = 25_000;
  if (cupOutcome.isWinner) budgetChange += 150_000;
  if (playoffFinish === "Grand Final Runner-Up") budgetChange += 120_000;

  let boardVerdict = "A steady season — the board want more next year.";
  if (isUserInChampionship(career)) {
    if (position === 1) {
      boardVerdict = "Outstanding — Championship champions.";
    } else if (position <= 2) {
      boardVerdict = "Promoted — Super League awaits.";
    } else if (position <= 4) {
      boardVerdict = "Top-four finish. Solid Championship campaign.";
    } else if (position >= 18) {
      boardVerdict = "Disappointing — improvements required.";
    }
  } else if (playoffFinish === "Super League Champions") {
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
    draws: career.draws ?? 0,
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
    wageBill: career.wageBill,
    expiringContracts: expiring,
    playersLeaving: leaving.map(
      (id) => getManagerPlayer(career, id)?.name ?? id
    ),
    seasonVerdict,
  };
}

export function advanceToNextSeason(career: ManagerCareer): ManagerCareer {
  const summary = buildSeasonSummary(career);
  const seasonStartFacilities = getClubFacilities(career);
  // Snapshot final tables for next season's Challenge Cup seeding (year on year).
  // Champ careers must use the live AI Super League table — not a stale prior snapshot.
  const previousSeasonLeagueTable = isUserInChampionship(career)
    ? standingsToCupSeeding(
        career.aiSuperLeagueStandings?.length
          ? career.aiSuperLeagueStandings
          : getCareerSuperLeagueClubs(career).map((team, i) => ({
              team,
              position: i + 1,
            }))
      )
    : standingsToCupSeeding(getManagerLeagueTable(career));
  const previousSeasonChampionshipTable = isUserInChampionship(career)
    ? standingsToCupSeeding(getManagerLeagueTable(career))
    : standingsToCupSeeding(career.championshipCompetition?.standings);

  const withTotals = tickClubCareerTotals(career);
  const withLoansReturned = returnExpiredLoans(withTotals);
  const { career: afterRetirements } = applySeasonRetirements(withLoansReturned);
  const afterLeagueRetirements = applyLeagueRetirements(afterRetirements);
  const { career: afterSquadContracts, leaving: squadLeaving } =
    tickContractsForNewSeason(afterLeagueRetirements);
  const { career: afterReserveContracts, leaving: reserveLeaving } =
    tickReserveContractsForNewSeason(afterSquadContracts);

  let withInbox = afterReserveContracts;
  for (const playerId of squadLeaving) {
    const name = getManagerPlayer(withInbox, playerId)?.name ?? playerId;
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

  // Promotion / relegation BEFORE rebuilding schedules.
  const {
    career: afterPromRel,
    userPromoted,
    userRelegated,
  } = applyPromotionRelegation({
    ...clearedTransfers,
    previousSeasonLeagueTable,
    previousSeasonChampionshipTable,
    leagueTable: getManagerLeagueTable(career),
  });

  const newSeed = `${career.seed}-s${career.seasonYear + 1}`;
  const nextYear = career.seasonYear + 1;
  const champClubs = getCareerChampionshipClubs(afterPromRel);
  const slClubs = getCareerSuperLeagueClubs(afterPromRel);
  const championshipCompetition = createChampionshipCompetition(
    newSeed,
    nextYear,
    { clubNames: champClubs }
  );

  let schedule;
  if (isUserInChampionship(afterPromRel)) {
    schedule = buildManagerScheduleFromChampionship(
      afterPromRel.club,
      championshipCompetition,
      newSeed
    );
  } else {
    schedule = buildManagerSchedule(afterPromRel.club, newSeed, {
      clubs: slClubs,
      seasonGames: getUserSeasonGames(afterPromRel),
      includeMagicWeekend: true,
    });
  }

  const leagueClubs = getUserLeagueClubs(afterPromRel);
  const config = getManagerClubConfig(afterPromRel.club);
  const boardExpectation =
    afterPromRel.userCompetitionId === "championship"
      ? CHAMPIONSHIP_EXPECTATION_LABELS[
          expectationTierFromStars(config.difficulty, "championship")
        ]
      : MANAGER_EXPECTATION_LABELS[
          expectationTierFromStars(config.difficulty, "super-league")
        ];

  const prevFinance = afterReserveContracts.managerFinance;
  const transferBudget = computeSeasonTransferBudget(
    afterPromRel.club,
    newSeed,
    career.seasonYear + 1,
    summary,
    prevFinance,
    getCareerClubStars(afterPromRel),
    getUserCompetitionId(afterPromRel)
  );

  const carriedOperating =
    afterReserveContracts.managerFinance?.operatingBalance ?? 0;

  const attendanceAfterSeason = applyAttendancePerformanceDrift(
    applySeasonAiReserveIntake(
      {
        ...afterPromRel,
        seasonHistory: [...career.seasonHistory, summary],
      },
      career.seasonYear + 1
    ),
    "season_end"
  ).attendanceData;

  const next: ManagerCareer = {
    ...afterPromRel,
    seasonYear: nextYear,
    seed: newSeed,
    budget: transferBudget,
    clubFundsEarned: afterReserveContracts.clubFundsEarned,
    boardConfidence: Math.min(85, boardConfidence + 10),
    boardExpectation:
      userPromoted || userRelegated
        ? boardExpectation
        : afterPromRel.boardExpectation,
    schedule,
    fixtures: [],
    roundMatches: [],
    gameWeek: 0,
    currentFixtureIndex: 0,
    matchWeekPhase: "ready_to_play",
    pendingMatchWeekId: null,
    lastProcessedMatchWeekId: null,
    currentRound: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    teamSeasonStats: { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: {},
    recentForm: [],
    isSeasonComplete: false,
    seasonHistory: [...career.seasonHistory, summary],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    gateIncomeHistory: [],
    attendanceData: attendanceAfterSeason,
    seasonAttendance: { total: 0, count: 0, high: 0, low: 0 },
    challengeCup: createManagerChallengeCup(newSeed, afterPromRel.club, {
      previousSeasonLeagueTable,
      previousSeasonChampionshipTable,
      championshipClubs: champClubs,
      superLeagueClubs: slClubs,
    }),
    challengeCupSchemaVersion: CHALLENGE_CUP_SCHEMA_VERSION,
    previousSeasonLeagueTable,
    previousSeasonChampionshipTable,
    championshipCompetition,
    championshipCompetitionVersion: championshipCompetition.version,
    /** Fresh AI Super League each Champ season — do not carry lastRound forever. */
    aiSuperLeagueStandings: undefined,
    aiSuperLeagueRoundMatches: undefined,
    aiSuperLeagueLastRound: undefined,
    championshipToSlTransfersThisSeason: 0,
    championshipTransferCooldowns: {},
    championshipReserveSigningsThisSeason: 0,
    reserveToChampionshipCooldowns: {},
    transferTargetCooldowns: {},
    transferTargetClubCooldowns: {},
    reserveToChampionshipClubCooldowns: {},
    reserveToChampionshipClubRequestCounts: {},
    playoffs: undefined,
    playoffsIntroAcknowledged: false,
    trophyCelebrationShown: false,
    leagueWinnersCelebrationShown: false,
    perfectSeasonCelebrationShown: false,
    winlessSeasonCelebrationShown: false,
    leaguePhaseStatsRecordedForYear: null,
    seasonCompleteStatsRecordedForYear: null,
    challengeCupCelebrationShown: false,
    worldClubChallengeCelebrationShown: false,
    wagePressureWeeks: 0,
    transferMarket: generateTransferMarket(withFreeAgents, newSeed, 0),
    nextMatchGameplan: null,
    activeLoans: withFreeAgents.activeLoans ?? [],
    squad: withFreeAgents.squad.map((p) => ({
      ...p,
      seasonAppearances: 0,
      seasonTries: 0,
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
    leagueTable: buildLeagueTableFromMatches([], afterPromRel.club, leagueClubs),
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
    latestNews: afterPromRel.latestNews ?? [],
    leagueTransfers: [],
    playerDevelopment: afterReserveContracts.playerDevelopment,
    lastSeasonDevelopmentReview: undefined,
    lastReserveReportWeek: undefined,
    leagueClubStates: initLeagueClubStates(),
    leagueClubStatesWeek: 0,
    clubFunds: refreshClubFundsForSeason(afterReserveContracts, summary),
    updatedAt: new Date().toISOString(),
  };

  const withIntake = simulateAiSeasonRosterActivity(
    simulateAiContractExpiries(
      applyYearlyYouthIntake(
        applyAiYouthIntakeToLeague(
          ensureLeagueClubRosters(reconcileLeagueRosters(next))
        )
      )
    )
  );
  const seasonListed = generateLeagueListedPlayers(withIntake, newSeed, 0);
  let finalCareer: ManagerCareer = {
    ...withIntake,
    leagueListedPlayers: seasonListed,
    transferMarket: seasonListed.map((l) => l.playerId),
  };
  awardManagerSeasonBoardGrant(finalCareer, summary);
  const { career: withPrestige } = applySeasonClubPrestigeDrift(
    finalCareer,
    summary,
    { seasonStartFacilities }
  );
  const withStarEconomy = resyncCareerEconomyToClubStars(withPrestige, summary);

  const previousSeasonChampion = resolveSeasonChampionForAdvance(
    finalizePlayoffTournamentForChampion(career)
  );

  const withChampion: ManagerCareer = {
    ...withStarEconomy,
    previousSeasonChampion,
    playerDevelopment: snapshotSquadSeasonStartRatings(withStarEconomy),
  };

  const aged = hydrateManagerPlayerRegistryAges(withChampion);
  const withTenure = tickReserveYearsAtClub(aged);
  return ensureAllClubReserveDepth(
    applyAutoPromoteByRating(
      scheduleWorldClubChallengeForSeason(withTenure)
    )
  );
}
