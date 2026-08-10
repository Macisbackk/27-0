import { migrateCareerHistory } from "./managerClubChange";
import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import type { ManagerCareer, ManagerSettings } from "./types";
import { DEFAULT_MANAGER_SETTINGS, DEFAULT_TACTICS } from "./types";
import { EMPTY_TEAM_SEASON_STATS, sanitizePlayerSeasonStats } from "./managerCareerStats";
import { sanitizeInvalidScorerData } from "./managerScorerSanitize";
import { migrateMatchWeekFields } from "./managerMatchWeek";
import { migrateChallengeCupRoundLabels } from "./challengeCupRounds";
import { ensureFreeAgentPool } from "./managerFreeAgents";
import { hydrateReserveTenure } from "./managerReserveRelease";
import { initLeagueClubStates, ensureLeagueClubStates } from "./managerLeagueState";
import {
  ensureLeagueClubRosters,
  initLeagueClubRosters,
} from "./managerLeagueRosters";
import { buildManagerSchedule, buildLeagueTableFromMatches, getManagerLeagueTable, syncManagerLeagueTable, reconcileRoundMatches, buildManagerScheduleFromChampionship } from "./managerFixtures";
import {
  getManagerClubConfig,
  expectationTierFromStars,
  MANAGER_EXPECTATION_LABELS,
  CHAMPIONSHIP_EXPECTATION_LABELS,
  buildDefaultLineupFromPlayers,
} from "./club-config";
import {
  getManagerLineupForClub,
  getManagerRosterIds,
} from "./managerRating";
import { createInitialPlayerState } from "./managerSquad";
import {
  buildContractsForSquad,
  computeWageBill,
  countExpiringContracts,
  ensureRenewalDemands,
  getWageBudgetForClub,
  resolveWageBudgetForCareer,
} from "./managerContracts";
import { createClubAttendanceData, syncClubAttendanceData } from "./managerAttendance";
import {
  createDefaultClubFacilities,
  ensureClubFacilities,
  getEffectiveStadiumCapacity,
} from "./managerFacilities";
import { createManagerChallengeCup, cupSeedingInputFromCareer, reconcileChallengeCupFromFixtures } from "./managerChallengeCup";
import { generateReserveSquad, initLeagueClubReserveCounts, reconcileLeagueClubReserveCounts, ensureAllClubReserveDepth, dedupeSquadAndReserves } from "./managerReserves";
import { sanitizeWorldClubChallengeState, ensureWorldClubChallengeScheduled } from "./worldClubChallenge";
import { ensureChampionshipSystems } from "./championship/ensureChampionship";
import {
  ensureLeagueMembership,
  isUserInChampionship,
  defaultSuperLeagueClubs,
  defaultChampionshipClubs,
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
} from "./leagueMembership";
import {
  generateChampionshipSquads,
  championshipPlayerToPlayer,
} from "./championship/championshipSquads";
import {
  createChampionshipCompetition,
} from "./championship/championshipLeague";
import { getChampionshipClubByName } from "../clubs/championship-clubs";
import { migrateSquadRoles } from "./migrateSquadRoles";
import { migrateReserveGeneratorV5 } from "./migrateReserveGeneratorV5";
import {
  migratePlayerRatingsV5,
  PLAYER_RATING_SCHEMA_VERSION,
  RESERVE_RATING_SCALE_VERSION,
} from "./migratePlayerRatingsV5";
import { migrateChampionshipFirstSeasonBalance } from "./migrateChampionshipFirstSeasonBalance";
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
import {
  ensureBoardEndOfSeasonReviewInbox,
  ensureBoardObjectivesInbox,
} from "./managerBoardInbox";
import { initPreSeasonState, ensureFriendlyChoices } from "./managerFriendlies";
import {
  countLeagueFixturesPlayed,
  ensureCupBracketReady,
} from "./managerChallengeCup";
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
import {
  maybeLogSaveSizeDiagnostics,
  measureCareerSaveSize,
} from "./managerSaveDiagnostics";
import { stampManagerSaveVersion, SIMPLIFIED_PLAYER_SYSTEMS_VERSION } from "./managerSaveVersion";

export const PLAYER_SHOWCASE_VERSION = 2;
export const HISTORIC_AGE_DATA_VERSION = 2;

function hydrateManagerSettings(
  raw: ManagerSettings | undefined
): ManagerSettings {
  const years = raw?.autoRenewContractYears;
  const autoRenewContractYears =
    years === 1 || years === 2 || years === 3 || years === 4
      ? years
      : DEFAULT_MANAGER_SETTINGS.autoRenewContractYears;

  const legacy = raw?.reserveReleaseSettings as
    | Record<string, unknown>
    | undefined;
  const modern = raw?.reserveDevelopmentSettings;
  const mergedDev: ManagerSettings["reserveDevelopmentSettings"] = {
    ...DEFAULT_MANAGER_SETTINGS.reserveDevelopmentSettings,
    ...(modern ?? {}),
    protectedFromMassReleaseIds: [
      ...(DEFAULT_MANAGER_SETTINGS.reserveDevelopmentSettings
        .protectedFromMassReleaseIds ?? []),
      ...((modern?.protectedFromMassReleaseIds as string[] | undefined) ?? []),
    ],
  };

  // Migrate legacy rating/age toggle fields if present on old saves.
  if (legacy && (!modern || (modern.reserveManagementSettingsVersion ?? 0) < 2)) {
    if (typeof legacy.releaseUnderRating === "number") {
      mergedDev.massReleaseRatingBelow = legacy.releaseUnderRating as number;
      mergedDev.massReleaseByRatingEnabled = true;
    }
    if (typeof legacy.releaseIfRatingBelow === "number") {
      mergedDev.massReleaseRatingBelow = legacy.releaseIfRatingBelow as number;
    }
    if (typeof legacy.fullTimeRatingThreshold === "number") {
      mergedDev.autoPromoteRatingThreshold =
        legacy.fullTimeRatingThreshold as number;
    }
    if (typeof legacy.minimumReserveSquadSize === "number") {
      mergedDev.minimumReserveSquadSize =
        legacy.minimumReserveSquadSize as number;
    }
    mergedDev.reserveManagementSettingsVersion = 2;
  }

  // v3: Match Mode toggle removed — always AND matching; ignore legacy field.
  if ((mergedDev.reserveManagementSettingsVersion ?? 0) < 3) {
    delete (mergedDev as { massReleaseMatchMode?: unknown }).massReleaseMatchMode;
    mergedDev.reserveManagementSettingsVersion = 3;
  }

  return {
    autoRenewContractYears,
    autoFixSquadBeforeMatch:
      raw?.autoFixSquadBeforeMatch ??
      DEFAULT_MANAGER_SETTINGS.autoFixSquadBeforeMatch,
    showAchievementPopups:
      raw?.showAchievementPopups ??
      DEFAULT_MANAGER_SETTINGS.showAchievementPopups,
    confirmBeforeSimulate:
      raw?.confirmBeforeSimulate ??
      DEFAULT_MANAGER_SETTINGS.confirmBeforeSimulate,
    highlightExpiringContracts:
      raw?.highlightExpiringContracts ??
      DEFAULT_MANAGER_SETTINGS.highlightExpiringContracts,
    reserveDevelopmentSettings: mergedDev,
    reserveReleaseSettings: mergedDev,
  };
}

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
  const withMembership = ensureLeagueMembership(raw);
  const gameWeek = withMembership.gameWeek ?? withMembership.currentRound ?? 0;
  const startingIds = new Set(withMembership.matchdayXiii ?? []);

  let contracts = withMembership.contracts ?? {};
  if (Object.keys(contracts).length === 0 && withMembership.squad?.length) {
    contracts = buildContractsForSquad(
      withMembership.squad.map((p) => p.playerId),
      startingIds,
      withMembership.club
    );
  }
  contracts = hydrateLegacyContracts(contracts);

  const wageBill =
    withMembership.wageBill ??
    computeCareerWageBill({
      ...withMembership,
      contracts,
      reserveContracts: withMembership.reserveContracts,
    } as ManagerCareer);
  const wageBudget = resolveWageBudgetForCareer({
    ...withMembership,
    contracts,
    wageBill,
    reserveContracts: withMembership.reserveContracts,
  } as ManagerCareer);

  let challengeCup = withMembership.challengeCup as ChallengeCupBracketState | undefined;
  const cupSeeding = {
    previousSeasonLeagueTable: withMembership.previousSeasonLeagueTable ?? null,
    previousSeasonChampionshipTable:
      withMembership.previousSeasonChampionshipTable ?? null,
    championshipClubs: getCareerChampionshipClubs(withMembership),
    superLeagueClubs: getCareerSuperLeagueClubs(withMembership),
  };
  if (!challengeCup?.matches?.length) {
    const cupPlayed = (withMembership.fixtures ?? []).some(
      (f) => f.competition === "challenge_cup"
    );
    const isNewCareer =
      (withMembership.fixtures?.length ?? 0) === 0 &&
      (withMembership.gameWeek ?? 0) === 0;
    if (!cupPlayed && (isNewCareer || !withMembership.challengeCup)) {
      challengeCup = createManagerChallengeCup(
        withMembership.seed ?? "migrate",
        withMembership.club,
        cupSeeding
      );
    }
  }
  if (!challengeCup) {
    challengeCup = createManagerChallengeCup(
      withMembership.seed ?? "migrate",
      withMembership.club,
      cupSeeding
    );
  }

  const clubFacilities = ensureClubFacilities(withMembership.clubFacilities);
  const attendanceData = withMembership.attendanceData
    ? syncClubAttendanceData(
        withMembership.club,
        withMembership.attendanceData,
        clubFacilities
      )
    : {
        ...createClubAttendanceData(withMembership.club),
        stadiumCapacity: getEffectiveStadiumCapacity(
          withMembership.club,
          clubFacilities
        ),
      };

  const schedule = (withMembership.schedule ?? []).map((s) => ({
    ...s,
    id: s.id ?? `legacy-r${s.round}`,
    competition: s.competition ?? ("league" as const),
    label: s.label ?? `Round ${s.round} — League`,
  }));

  const leagueTable = getManagerLeagueTable({
    ...withMembership,
    roundMatches: withMembership.roundMatches ?? [],
    leagueTable: withMembership.leagueTable ?? [],
    fixtures: withMembership.fixtures ?? [],
  } as ManagerCareer).map((row) => ({
    ...row,
    isUserTeam: row.isUserTeam ?? row.team === withMembership.club,
  }));

  let career: ManagerCareer = {
    ...withMembership,
    difficulty:
      withMembership.difficulty ??
      getManagerClubConfig(withMembership.club).difficulty,
    prestigeMomentum: withMembership.prestigeMomentum ?? 0,
    clubStarRiseCelebratedAt:
      withMembership.clubStarRiseCelebratedAt ??
      withMembership.difficulty ??
      getManagerClubConfig(withMembership.club).difficulty,
    gameWeek,
    leagueTable,
    currentFixtureIndex:
      withMembership.currentFixtureIndex ?? withMembership.currentRound ?? 0,
    teamSeasonStats:
      withMembership.teamSeasonStats ?? { ...EMPTY_TEAM_SEASON_STATS },
    playerSeasonStats: withMembership.playerSeasonStats ?? {},
    recentForm:
      withMembership.recentForm ??
      withMembership.fixtures?.map((f) => f.result) ??
      [],
    tactics: withMembership.tactics
      ? {
          playingStyle:
            withMembership.tactics.playingStyle ?? DEFAULT_TACTICS.playingStyle,
          attackFocus:
            withMembership.tactics.attackFocus ?? DEFAULT_TACTICS.attackFocus,
          defenceFocus:
            withMembership.tactics.defenceFocus ?? DEFAULT_TACTICS.defenceFocus,
        }
      : { ...DEFAULT_TACTICS },
    matchPlayerRoles: withMembership.matchPlayerRoles ?? {},
    nextMatchGameplan: withMembership.nextMatchGameplan ?? null,
    activeLoans: withMembership.activeLoans ?? [],
    contracts,
    wageBudget,
    wageBill,
    attendanceData,
    clubFacilities,
    gateIncomeHistory: (withMembership.gateIncomeHistory ?? []).map((r) =>
      hydrateGateIncomeRecord(r)
    ),
    challengeCup,
    seasonAttendance: withMembership.seasonAttendance ?? {
      total: 0,
      count: 0,
      high: 0,
      low: 0,
    },
    schedule,
    squad: (withMembership.squad ?? []).map((p) => ({
      playerId: p.playerId,
      form: p.form ?? 50,
      injury: p.injury ?? null,
      seasonAppearances: p.seasonAppearances ?? 0,
      seasonTries: p.seasonTries ?? 0,
    })),
    reserves:
      withMembership.reserves?.length
        ? withMembership.reserves.map((r) => ({
            ...r,
            signedRating: r.signedRating ?? r.baseRating ?? r.rating,
            baseRating: r.baseRating ?? r.rating,
            signedSeasonYear:
              r.signedSeasonYear ?? withMembership.seasonYear,
            yearsAtClub:
              r.yearsAtClub ??
              Math.max(
                0,
                (withMembership.seasonYear ?? 0) -
                  (r.signedSeasonYear ?? withMembership.seasonYear ?? 0)
              ),
          }))
        : generateReserveSquad(
            withMembership.seed ?? "migrate",
            24,
            withMembership.club
          ),
    reserveContracts:
      withMembership.reserveContracts ??
      buildReserveContractsForReserves(
        withMembership.reserves?.length
          ? withMembership.reserves
          : generateReserveSquad(
              withMembership.seed ?? "migrate",
              24,
              withMembership.club
            )
      ),
    youthProspects: withMembership.youthProspects ?? [],
    reserveResults: withMembership.reserveResults ?? [],
    lastReserveResult: withMembership.lastReserveResult ?? null,
    calledUpReserveIds: withMembership.calledUpReserveIds ?? [],
    playerRegistry: withMembership.playerRegistry ?? {},
    hubResultsExpanded: withMembership.hubResultsExpanded ?? false,
    leagueListedPlayers:
      withMembership.leagueListedPlayers ??
      generateLeagueListedPlayers(
        withMembership,
        withMembership.seed ?? "migrate",
        withMembership.gameWeek ?? 0
      ),
    playerTransferStatus: withMembership.playerTransferStatus ?? {},
    inboxMessages: withMembership.inboxMessages ?? [],
    clubFunds:
      withMembership.clubFunds ??
      initClubTransferBudgets(
        withMembership.club,
        withMembership.seed ?? "migrate"
      ),
    transferMarket:
      withMembership.transferMarket ??
      (withMembership.leagueListedPlayers ?? []).map((l) => l.playerId),
    preSeason: initPreSeasonState(withMembership),
    managerFinance: initManagerFinance(withMembership),
    latestNews: withMembership.latestNews ?? [],
    leagueTransfers: withMembership.leagueTransfers ?? [],
    freeAgents: withMembership.freeAgents ?? [],
    wagePressureWeeks: withMembership.wagePressureWeeks ?? 0,
    lastReserveReportWeek: withMembership.lastReserveReportWeek,
    leagueClubStates: ensureLeagueClubStates(withMembership.leagueClubStates),
    leagueClubStatesWeek: withMembership.leagueClubStatesWeek ?? 0,
    leagueClubRosters: withMembership.leagueClubRosters,
    leagueClubReserveCounts: withMembership.leagueClubReserveCounts,
    leagueClubReserves: withMembership.leagueClubReserves,
    reserveToChampionshipCooldowns:
      withMembership.reserveToChampionshipCooldowns ?? {},
    transferTargetCooldowns: withMembership.transferTargetCooldowns ?? {},
    transferTargetClubCooldowns:
      withMembership.transferTargetClubCooldowns ?? {},
    reserveToChampionshipClubCooldowns:
      withMembership.reserveToChampionshipClubCooldowns ?? {},
    reserveToChampionshipClubRequestCounts:
      withMembership.reserveToChampionshipClubRequestCounts ?? {},
    championshipReserveSigningsThisSeason:
      withMembership.championshipReserveSigningsThisSeason ?? 0,
    playerDevelopment: withMembership.playerDevelopment ?? {},
    playerLearnedPositions: withMembership.playerLearnedPositions ?? {},
    playerPositionRetraining: withMembership.playerPositionRetraining ?? {},
    lastSeasonDevelopmentReview: withMembership.lastSeasonDevelopmentReview,
    clubCareerTotals: withMembership.clubCareerTotals ?? {},
    retiredPlayers: withMembership.retiredPlayers ?? [],
    managerSettings: hydrateManagerSettings(withMembership.managerSettings),
    playerShowcaseVersion: PLAYER_SHOWCASE_VERSION,
    historicAgeDataVersion: HISTORIC_AGE_DATA_VERSION,
    simplifiedPlayerSystemsVersion: SIMPLIFIED_PLAYER_SYSTEMS_VERSION,
  };

  career = ensureRenewalDemands(career);
  career = ensureReserveRenewalDemands(career);
  career = reconcileRoundMatches(career);
  career = {
    ...career,
    challengeCup: reconcileChallengeCupFromFixtures(career),
  };
  career = hydrateInboxMessages(career);
  if (career.objectivesIntroShown) {
    career = ensureBoardObjectivesInbox(career);
  }
  career = syncManagerFinance(career);
  career = ensureFriendlyChoices(career);
  career = ensureCupBracketReady(career);
  career = syncManagerLeagueTable(career);
  if (!isUserInChampionship(career)) {
    career = ensurePlayoffsReady(career);
    career = syncPlayoffsIntroAcknowledged(career);
  }
  career = {
    ...career,
    isSeasonComplete: isManagerSeasonComplete(career),
  };
  if (career.isSeasonComplete) {
    career = ensureBoardEndOfSeasonReviewInbox(career);
  }
  career = ensureSeasonEndPlayerDevelopment(career);
  career = ensureLeagueClubRosters(career);
  career = normalizeMatchdayLineup(career);
  career = dedupeSquadAndReserves(career);
  if (!Array.isArray(career.transferWatchlistIds)) {
    career = { ...career, transferWatchlistIds: [] };
  }
  if (!career.leagueClubReserveCounts) {
    career = {
      ...career,
      leagueClubReserveCounts: initLeagueClubReserveCounts(),
    };
  }
  career = reconcileLeagueClubReserveCounts(career);
  career = ensureAllClubReserveDepth(career);
  career = sanitizeWorldClubChallengeState(career);
  career = ensureWorldClubChallengeScheduled(career);
  career = {
    ...career,
    playerSeasonStats: sanitizePlayerSeasonStats(career),
  };
  career = sanitizeInvalidScorerData(career);
  career = hydrateReserveTenure(career);
  career = ensureFreeAgentPool(career);
  career = migrateMatchWeekFields(career);
  career = migratePlayerRatingsV5(career);
  career = migrateChampionshipFirstSeasonBalance(career);
  career = migrateReserveGeneratorV5(career);
  career = migrateSquadRoles(career);
  career = ensureChampionshipSystems(career);
  career = migrateChallengeCupRoundLabels(career);
  career = migrateCareerHistory(career);
  career = repairPrematureLeaguePhaseCredit(career);
  return syncManagerInboxMessages(career);
}

/**
 * Saves touched by the empty-schedule bug had this season's league finish
 * credited before a single game, which also blocked the real finish from ever
 * being credited. Clearing the marker lets the genuine result record.
 */
function repairPrematureLeaguePhaseCredit(
  career: ManagerCareer
): ManagerCareer {
  if (career.leaguePhaseStatsRecordedForYear !== career.seasonYear) {
    return career;
  }
  if (countLeagueFixturesPlayed(career) > 0) return career;
  return { ...career, leaguePhaseStatsRecordedForYear: null };
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
    wageBudget: resolveWageBudgetForCareer({
      ...raw,
      contracts,
      wageBill,
      reserveContracts: raw.reserveContracts,
    } as ManagerCareer),
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
  const prepared = stampManagerSaveVersion(career);
  maybeLogSaveSizeDiagnostics(prepared, "prepareManagerCareerForSave");
  return prepared;
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
  const prepared = prepareManagerCareerForSave(career);
  maybeLogSaveSizeDiagnostics(prepared, "saveManagerCareer");
  return writeManagerCareerRaw(prepared, slot);
}

/** Immediate disk flush for lifecycle hooks (page hide, unmount, etc.). */
export function flushManagerCareerToDisk(
  career: ManagerCareer,
  slot?: number
): { ok: true } | { ok: false; error: string } {
  return saveManagerCareer(career, slot);
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
  const isChampCareer = config.competition === "championship";
  const seasonYear = new Date().getFullYear();

  let rosterIds: string[];
  let lineup: {
    xiiiIds: string[];
    slotPositions: import("../types").Position[];
    benchIds: string[];
  };
  let playerRegistry: ManagerCareer["playerRegistry"] = {};
  let championshipSquads: ManagerCareer["championshipSquads"];
  let championshipCompetition: ManagerCareer["championshipCompetition"];
  let schedule: ReturnType<typeof buildManagerSchedule>;

  if (isChampCareer) {
    championshipSquads = generateChampionshipSquads(seed, seasonYear);
    const champClub = getChampionshipClubByName(club);
    if (!champClub) {
      throw new Error(`Championship club not found: ${club}`);
    }
    rosterIds = [...(championshipSquads.rosterByClub[champClub.id] ?? [])];
    const converted = rosterIds
      .map((id) => championshipSquads!.players[id])
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map(championshipPlayerToPlayer);
    playerRegistry = Object.fromEntries(converted.map((p) => [p.id, p]));
    const built = buildDefaultLineupFromPlayers(rosterIds, converted);
    if (!built) {
      throw new Error(`Could not build Championship lineup for ${club}`);
    }
    lineup = built;
    championshipCompetition = createChampionshipCompetition(seed, seasonYear, {
      clubNames: defaultChampionshipClubs(),
    });
    schedule = buildManagerScheduleFromChampionship(
      club,
      championshipCompetition,
      seed
    );
  } else {
    rosterIds = getManagerRosterIds(club);
    lineup = getManagerLineupForClub(club);
    schedule = buildManagerSchedule(club, seed);
  }

  const squad = rosterIds.map((id) => createInitialPlayerState(id));
  const startingIds = new Set(lineup.xiiiIds);
  const contracts = buildContractsForSquad(rosterIds, startingIds, club);

  const transferBudget = computeFirstSeasonTransferBudget(
    club,
    seed,
    config.difficulty,
    isChampCareer ? "championship" : "super-league"
  );

  const reserves = generateReserveSquad(seed, 24, club);
  const reserveContracts = buildReserveContractsForReserves(reserves);
  const wageBill = computeCareerWageBill({
    contracts,
    reserveContracts,
  } as ManagerCareer);
  const initialWageBudget = getWageBudgetForClub(
    club,
    config.difficulty,
    isChampCareer ? "championship" : "super-league"
  );

  const clubFacilities = createDefaultClubFacilities();
  const attendanceData = {
    ...createClubAttendanceData(club),
    stadiumCapacity: getEffectiveStadiumCapacity(club, clubFacilities),
  };

  const boardExpectation = isChampCareer
    ? CHAMPIONSHIP_EXPECTATION_LABELS[
        expectationTierFromStars(config.difficulty, "championship")
      ]
    : MANAGER_EXPECTATION_LABELS[
        expectationTierFromStars(config.difficulty, "super-league")
      ];

  const leagueClubs = isChampCareer
    ? defaultChampionshipClubs()
    : defaultSuperLeagueClubs();

  const career: ManagerCareer = {
    id: seed,
    club,
    userCompetitionId: isChampCareer ? "championship" : "super-league",
    superLeagueClubNames: defaultSuperLeagueClubs(),
    championshipClubNames: defaultChampionshipClubs(),
    seasonYear,
    seed,
    budget: transferBudget,
    clubFundsEarned: 0,
    boardConfidence: 65,
    boardExpectation,
    difficulty: config.difficulty,
    prestigeMomentum: 0,
    clubStarRiseCelebratedAt: config.difficulty,
    tactics: { ...DEFAULT_TACTICS },
    matchPlayerRoles: {},
    nextMatchGameplan: null,
    activeLoans: [],
    squad,
    contracts,
    wageBudget: initialWageBudget,
    wageBill,
    attendanceData,
    clubFacilities,
    gateIncomeHistory: [],
    challengeCup: createManagerChallengeCup(
      seed,
      club,
      cupSeedingInputFromCareer({
        club,
        seed,
        userCompetitionId: isChampCareer ? "championship" : "super-league",
        superLeagueClubNames: defaultSuperLeagueClubs(),
        championshipClubNames: defaultChampionshipClubs(),
      } as ManagerCareer)
    ),
    matchdayXiii: lineup.xiiiIds,
    matchdayInterchange: lineup.benchIds,
    xiiiSlotPositions: lineup.slotPositions,
    schedule,
    fixtures: [],
    roundMatches: [],
    gameWeek: 0,
    currentFixtureIndex: 0,
    currentRound: 0,
    matchWeekPhase: "ready_to_play",
    pendingMatchWeekId: null,
    lastProcessedMatchWeekId: null,
    leagueTable: buildLeagueTableFromMatches([], club, leagueClubs),
    transferMarket: [],
    transferWatchlistIds: [],
    leagueListedPlayers: [],
    playerTransferStatus: {},
    inboxMessages: [],
    clubFunds: initClubTransferBudgets(club, seed),
    preSeason: initPreSeasonState({}),
    managerFinance: {
      transferBudget,
      operatingBalance: Math.round(initialWageBudget * 0.2),
      wageBudget: initialWageBudget,
      wageBill,
      clubFunds: transferBudget + Math.round(initialWageBudget * 0.2),
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
    draws: 0,
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
    playerRegistry,
    championshipSquads,
    championshipCompetition,
    championshipCompetitionVersion: championshipCompetition?.version,
    generatedChampionshipSquadsVersion: championshipSquads?.version,
    hubResultsExpanded: false,
    objectivesIntroShown: false,
    leagueClubStates: initLeagueClubStates(),
    leagueClubStatesWeek: 0,
    // Parallel SL AI world even when the user starts in the Championship.
    leagueClubRosters: initLeagueClubRosters(
      isChampCareer ? "__championship_user__" : club
    ),
    leagueClubReserveCounts: initLeagueClubReserveCounts(),
    managerSettings: { ...DEFAULT_MANAGER_SETTINGS },
    managerId: seed,
    worldSaveId: seed,
    userControlledClubId: club,
    managerCareerHistory: [
      {
        id: `hist-${seed}-${club}`,
        clubId: club,
        clubName: club,
        joinedSeason: seasonYear,
        joinedWeek: 0,
        joinedDate: new Date().toISOString(),
        boardExpectationAtJoin: boardExpectation,
      },
    ],
    managerCareerWorldSchemaVersion: 2,
    boostUsage: {},
    boardSackingSchemaVersion: 1,
    playerRatingSchemaVersion: PLAYER_RATING_SCHEMA_VERSION,
    reserveRatingScaleVersion: RESERVE_RATING_SCALE_VERSION,
    playerShowcaseVersion: PLAYER_SHOWCASE_VERSION,
    historicAgeDataVersion: HISTORIC_AGE_DATA_VERSION,
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
  hydrated = ensureAllClubReserveDepth(hydrated);
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

export { measureCareerSaveSize };
