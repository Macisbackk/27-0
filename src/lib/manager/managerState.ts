import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import type { ManagerCareer } from "./types";
import { DEFAULT_TACTICS } from "./types";
import { EMPTY_TEAM_SEASON_STATS } from "./managerCareerStats";
import { initLeagueClubStates, ensureLeagueClubStates } from "./managerLeagueState";
import {
  ensureLeagueClubRosters,
  initLeagueClubRosters,
} from "./managerLeagueRosters";
import { getManagerClubConfig, expectationTierFromStars, MANAGER_EXPECTATION_LABELS } from "./club-config";
import {
  getManagerLineupForClub,
  getManagerRosterIds,
} from "./managerRating";
import { createInitialPlayerState } from "./managerSquad";
import { buildManagerSchedule, buildLeagueTableFromMatches, getManagerLeagueTable, syncManagerLeagueTable, reconcileRoundMatches } from "./managerFixtures";
import {
  buildContractsForSquad,
  computeWageBill,
  countExpiringContracts,
  ensureRenewalDemands,
  getWageBudgetForClub,
} from "./managerContracts";
import { createClubAttendanceData, syncClubAttendanceData } from "./managerAttendance";
import { createManagerChallengeCup, reconcileChallengeCupFromFixtures } from "./managerChallengeCup";
import { generateReserveSquad, initLeagueClubReserveCounts, reconcileLeagueClubReserveCounts } from "./managerReserves";
import { stampManagerSaveVersion } from "./managerSaveVersion";
import { snapshotSquadSeasonStartRatings } from "./managerPlayerDevelopment";
import {
  applyYearlyYouthIntake,
  buildReserveContractsForReserves,
  computeCareerWageBill,
  ensureReserveRenewalDemands,
} from "./managerReserveContracts";
import { generateLeagueListedPlayers } from "./managerTransferLeague";
import {
  hydrateInboxMessages,
  syncManagerInboxMessages,
} from "./managerInbox";
import { initPreSeasonState, ensureFriendlyChoices } from "./managerFriendlies";
import { ensureCupBracketReady } from "./managerChallengeCup";
import { ensurePlayoffsReady, syncPlayoffsIntroAcknowledged } from "./managerPlayoffs";
import { ensureSeasonEndPlayerDevelopment } from "./managerPlayerDevelopment";
import { normalizeMatchdayLineup } from "./matchday-lineup";
import { isManagerSeasonComplete } from "./managerSimulation";
import {
  initManagerFinance,
  computeFirstSeasonTransferBudget,
  syncManagerFinance,
  initClubTransferBudgets,
  hydrateGateIncomeRecord,
} from "./managerFinance";

import {
  deleteManagerCareerRaw,
  getActiveSaveSlot,
  hasAnyManagerCareer,
  hasManagerCareerInSlot,
  listManagerSaveSlots,
  MANAGER_SAVE_SLOT_COUNT,
  readManagerCareerRaw,
  setActiveSaveSlot,
  writeManagerCareerRaw,
  type ManagerSaveSlotSummary,
} from "./managerSaveStorage";

/** Backfill missing contract fields on older saves. */
function hydrateLegacyContracts(
  contracts: ManagerCareer["contracts"]
): ManagerCareer["contracts"] {
  const next = { ...contracts };
  for (const [playerId, contract] of Object.entries(next)) {
    if (contract.purchaseFee === undefined) {
      next[playerId] = { ...contract, purchaseFee: 0 };
    }
  }
  return next;
}

export function hydrateManagerCareer(raw: ManagerCareer): ManagerCareer {
  const gameWeek = raw.gameWeek ?? raw.currentRound ?? 0;
  const startingIds = new Set(raw.matchdayXiii ?? []);

  let contracts = raw.contracts ?? {};
  if (Object.keys(contracts).length === 0 && raw.squad?.length) {
    contracts = buildContractsForSquad(
      raw.squad.map((p) => p.playerId),
      startingIds,
      raw.club
    );
  }
  contracts = hydrateLegacyContracts(contracts);

  const wageBill =
    raw.wageBill ??
    computeCareerWageBill({
      ...raw,
      contracts,
      reserveContracts: raw.reserveContracts,
    } as ManagerCareer);
  const wageBudget = getWageBudgetForClub(raw.club);

  let challengeCup = raw.challengeCup as ChallengeCupBracketState | undefined;
  if (!challengeCup?.matches?.length) {
    const cupPlayed = (raw.fixtures ?? []).some(
      (f) => f.competition === "challenge_cup"
    );
    const isNewCareer =
      (raw.fixtures?.length ?? 0) === 0 && (raw.gameWeek ?? 0) === 0;
    if (!cupPlayed && (isNewCareer || !raw.challengeCup)) {
      challengeCup = createManagerChallengeCup(raw.seed ?? "migrate", raw.club);
    }
  }
  if (!challengeCup) {
    challengeCup = createManagerChallengeCup(raw.seed ?? "migrate", raw.club);
  }

  const attendanceData = raw.attendanceData
    ? syncClubAttendanceData(raw.club, raw.attendanceData)
    : createClubAttendanceData(raw.club);

  const schedule = (raw.schedule ?? []).map((s) => ({
    ...s,
    id: s.id ?? `legacy-r${s.round}`,
    competition: s.competition ?? ("league" as const),
    label: s.label ?? `Round ${s.round} — League`,
  }));

  const leagueTable = getManagerLeagueTable({
    ...raw,
    roundMatches: raw.roundMatches ?? [],
    leagueTable: raw.leagueTable ?? [],
    fixtures: raw.fixtures ?? [],
  } as ManagerCareer).map((row) => ({
    ...row,
    isUserTeam: row.isUserTeam ?? row.team === raw.club,
  }));

  let career: ManagerCareer = {
    ...raw,
    difficulty: raw.difficulty ?? getManagerClubConfig(raw.club).difficulty,
    prestigeMomentum: raw.prestigeMomentum ?? 0,
    gameWeek,
    leagueTable,
    currentFixtureIndex: raw.currentFixtureIndex ?? raw.currentRound ?? 0,
    teamSeasonStats: raw.teamSeasonStats ?? { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: raw.playerSeasonStats ?? {},
    recentForm: raw.recentForm ?? raw.fixtures?.map((f) => f.result) ?? [],
    tactics: raw.tactics
      ? {
          playingStyle: raw.tactics.playingStyle ?? DEFAULT_TACTICS.playingStyle,
          attackFocus: raw.tactics.attackFocus ?? DEFAULT_TACTICS.attackFocus,
          defenceFocus: raw.tactics.defenceFocus ?? DEFAULT_TACTICS.defenceFocus,
        }
      : { ...DEFAULT_TACTICS },
    contracts,
    wageBudget,
    wageBill,
    attendanceData,
    gateIncomeHistory: (raw.gateIncomeHistory ?? []).map((r) =>
      hydrateGateIncomeRecord(r)
    ),
    challengeCup,
    seasonAttendance: raw.seasonAttendance ?? {
      total: 0,
      count: 0,
      high: 0,
      low: 0,
    },
    schedule,
    squad: (raw.squad ?? []).map((p) => ({
      playerId: p.playerId,
      form: p.form ?? 50,
      fitness: p.fitness ?? 85,
      injury: p.injury ?? null,
      seasonAppearances: p.seasonAppearances ?? 0,
      seasonTries: p.seasonTries ?? 0,
    })),
    reserves:
      raw.reserves?.length
        ? raw.reserves.map((r) => ({
            ...r,
            baseRating: r.baseRating ?? r.rating,
          }))
        : generateReserveSquad(raw.seed ?? "migrate", 24, raw.club),
    reserveContracts:
      raw.reserveContracts ??
      buildReserveContractsForReserves(
        raw.reserves?.length
          ? raw.reserves
          : generateReserveSquad(raw.seed ?? "migrate", 24, raw.club)
      ),
    youthProspects: raw.youthProspects ?? [],
    reserveResults: raw.reserveResults ?? [],
    lastReserveResult: raw.lastReserveResult ?? null,
    calledUpReserveIds: raw.calledUpReserveIds ?? [],
    playerRegistry: raw.playerRegistry ?? {},
    hubResultsExpanded: raw.hubResultsExpanded ?? false,
    leagueListedPlayers:
      raw.leagueListedPlayers ??
      generateLeagueListedPlayers(
        raw,
        raw.seed ?? "migrate",
        raw.gameWeek ?? 0
      ),
    playerTransferStatus: raw.playerTransferStatus ?? {},
    inboxMessages: raw.inboxMessages ?? [],
    clubFunds: raw.clubFunds ?? initClubTransferBudgets(raw.club, raw.seed ?? "migrate"),
    transferMarket:
      raw.transferMarket ??
      (raw.leagueListedPlayers ?? []).map((l) => l.playerId),
    preSeason: initPreSeasonState(raw),
    managerFinance: initManagerFinance(raw),
    latestNews: raw.latestNews ?? [],
    leagueTransfers: raw.leagueTransfers ?? [],
    freeAgents: raw.freeAgents ?? [],
    wagePressureWeeks: raw.wagePressureWeeks ?? 0,
    lastReserveReportWeek: raw.lastReserveReportWeek,
    leagueClubStates: ensureLeagueClubStates(raw.leagueClubStates),
    leagueClubStatesWeek: raw.leagueClubStatesWeek ?? 0,
    leagueClubRosters: raw.leagueClubRosters,
    leagueClubReserveCounts: raw.leagueClubReserveCounts,
    playerDevelopment: raw.playerDevelopment ?? {},
    playerLearnedPositions: raw.playerLearnedPositions ?? {},
    playerPositionRetraining: raw.playerPositionRetraining ?? {},
    lastSeasonDevelopmentReview: raw.lastSeasonDevelopmentReview,
    clubCareerTotals: raw.clubCareerTotals ?? {},
    retiredPlayers: raw.retiredPlayers ?? [],
  };

  career = ensureRenewalDemands(career);
  career = ensureReserveRenewalDemands(career);
  career = reconcileRoundMatches(career);
  career = {
    ...career,
    challengeCup: reconcileChallengeCupFromFixtures(career),
  };
  career = hydrateInboxMessages(career);
  career = syncManagerFinance(career);
  career = ensureFriendlyChoices(career);
  career = ensureCupBracketReady(career);
  career = syncManagerLeagueTable(career);
  career = ensurePlayoffsReady(career);
  career = syncPlayoffsIntroAcknowledged(career);
  career = {
    ...career,
    isSeasonComplete: isManagerSeasonComplete(career),
  };
  career = ensureSeasonEndPlayerDevelopment(career);
  career = ensureLeagueClubRosters(career);
  career = normalizeMatchdayLineup(career);
  if (!career.leagueClubReserveCounts) {
    career = {
      ...career,
      leagueClubReserveCounts: initLeagueClubReserveCounts(),
    };
  }
  career = reconcileLeagueClubReserveCounts(career);
  return syncManagerInboxMessages(career);
}

/** Light save-path sync — no AI cup/playoff sim, inbox rolls, or season development. */
export function prepareManagerCareerForSave(raw: ManagerCareer): ManagerCareer {
  let contracts = raw.contracts ?? {};
  contracts = hydrateLegacyContracts(contracts);
  const wageBill = computeCareerWageBill({
    ...raw,
    contracts,
    reserveContracts: raw.reserveContracts,
  } as ManagerCareer);

  let career: ManagerCareer = {
    ...raw,
    gameWeek: raw.gameWeek ?? raw.currentRound ?? 0,
    contracts,
    wageBill,
    wageBudget: raw.wageBudget ?? getWageBudgetForClub(raw.club),
  };

  career = ensureRenewalDemands(career);
  career = ensureReserveRenewalDemands(career);
  career = syncManagerFinance(career);
  career = syncManagerLeagueTable(career);
  career = syncPlayoffsIntroAcknowledged(career);
  career = ensureFriendlyChoices(career);
  career = ensureLeagueClubRosters(career);
  career = {
    ...career,
    challengeCup: reconcileChallengeCupFromFixtures(career),
  };
  career = reconcileRoundMatches(career);
  career = {
    ...career,
    isSeasonComplete: isManagerSeasonComplete(career),
  };
  return stampManagerSaveVersion(career);
}

export function loadManagerCareer(slot?: number): ManagerCareer | null {
  const raw = readManagerCareerRaw(slot);
  if (!raw) return null;
  return hydrateManagerCareer(raw);
}

export function saveManagerCareer(
  career: ManagerCareer,
  slot?: number
): { ok: true } | { ok: false; error: string } {
  return writeManagerCareerRaw(prepareManagerCareerForSave(career), slot);
}

export function deleteManagerCareer(slot?: number): void {
  deleteManagerCareerRaw(slot);
}

export function hasManagerCareer(slot?: number): boolean {
  return hasManagerCareerInSlot(slot);
}

export function createNewCareer(club: string, slot?: number): ManagerCareer {
  const targetSlot = slot ?? getActiveSaveSlot();
  setActiveSaveSlot(targetSlot);
  const config = getManagerClubConfig(club);
  const seed = `mgr-${club}-${Date.now()}`;
  const rosterIds = getManagerRosterIds(club);
  const lineup = getManagerLineupForClub(club);
  const squad = rosterIds.map((id) => createInitialPlayerState(id));
  const startingIds = new Set(lineup.xiiiIds);
  const contracts = buildContractsForSquad(rosterIds, startingIds, club);
  const wageBudget = getWageBudgetForClub(club);

  const schedule = buildManagerSchedule(club, seed);
  const squadIdSet = new Set(squad.map((p) => p.playerId));

  const transferBudget = computeFirstSeasonTransferBudget(club, seed);

  const reserves = generateReserveSquad(seed, 24, club);
  const reserveContracts = buildReserveContractsForReserves(reserves);
  const wageBill = computeCareerWageBill({
    contracts,
    reserveContracts,
  } as ManagerCareer);

  const career: ManagerCareer = {
    id: seed,
    club,
    seasonYear: new Date().getFullYear(),
    seed,
    budget: transferBudget,
    clubFundsEarned: 0,
    boardConfidence: 65,
    boardExpectation:
      MANAGER_EXPECTATION_LABELS[expectationTierFromStars(config.difficulty)],
    difficulty: config.difficulty,
    prestigeMomentum: 0,
    tactics: { ...DEFAULT_TACTICS },
    squad,
    contracts,
    wageBudget,
    wageBill,
    attendanceData: createClubAttendanceData(club),
    gateIncomeHistory: [],
    challengeCup: createManagerChallengeCup(seed, club),
    matchdayXiii: lineup.xiiiIds,
    matchdayInterchange: lineup.benchIds,
    xiiiSlotPositions: lineup.slotPositions,
    schedule,
    fixtures: [],
    roundMatches: [],
    gameWeek: 0,
    currentFixtureIndex: 0,
    currentRound: 0,
    leagueTable: buildLeagueTableFromMatches([], club),
    transferMarket: [],
    leagueListedPlayers: [],
    playerTransferStatus: {},
    inboxMessages: [],
    clubFunds: initClubTransferBudgets(club, seed),
    preSeason: initPreSeasonState({}),
    managerFinance: {
      transferBudget,
      operatingBalance: Math.round(wageBudget * 0.2),
      wageBudget,
      wageBill,
      clubFunds: transferBudget + Math.round(wageBudget * 0.2),
      seasonIncome: 0,
      seasonTransferIncome: 0,
      seasonOperatingIncome: 0,
      seasonSpending: 0,
    },
    latestNews: [],
    leagueTransfers: [],
    freeAgents: [],
    playerLearnedPositions: {},
    playerPositionRetraining: {},
    wins: 0,
    losses: 0,
    teamSeasonStats: { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: {},
    recentForm: [],
    isSeasonComplete: false,
    seasonHistory: [],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    seasonAttendance: { total: 0, count: 0, high: 0, low: 0 },
    reserves,
    reserveContracts,
    youthProspects: [],
    reserveResults: [],
    lastReserveResult: null,
    calledUpReserveIds: [],
    playerRegistry: {},
    hubResultsExpanded: false,
    objectivesIntroShown: false,
    leagueClubStates: initLeagueClubStates(),
    leagueClubStatesWeek: 0,
    leagueClubRosters: initLeagueClubRosters(club),
    leagueClubReserveCounts: initLeagueClubReserveCounts(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let hydrated = hydrateManagerCareer(career);
  const leagueListed = generateLeagueListedPlayers(hydrated, seed, 0);
  hydrated = {
    ...hydrated,
    leagueListedPlayers: leagueListed,
    transferMarket: leagueListed.map((l) => l.playerId),
  };
  hydrated = applyYearlyYouthIntake(hydrated);
  hydrated = {
    ...hydrated,
    playerDevelopment: snapshotSquadSeasonStartRatings(hydrated),
  };
  saveManagerCareer(hydrated, targetSlot);
  return hydrated;
}

export { buildSeasonSummary, advanceToNextSeason } from "./managerStateSeason";

export {
  getActiveSaveSlot,
  setActiveSaveSlot,
  listManagerSaveSlots,
  hasAnyManagerCareer,
  MANAGER_SAVE_SLOT_COUNT,
  type ManagerSaveSlotSummary,
} from "./managerSaveStorage";
