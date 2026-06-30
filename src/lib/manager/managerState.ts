import type { ChallengeCupBracketState } from "../game/challenge-cup-bracket";
import type { ManagerCareer } from "./types";
import { DEFAULT_TACTICS } from "./types";
import { EMPTY_TEAM_SEASON_STATS } from "./managerCareerStats";
import { getManagerClubConfig } from "./club-config";
import {
  getManagerLineupForClub,
  getManagerRosterIds,
} from "./managerRating";
import { createInitialPlayerState } from "./managerSquad";
import { buildManagerSchedule, buildLeagueTableFromMatches } from "./managerFixtures";
import { generateTransferMarket } from "./managerTransfers";
import {
  buildContractsForSquad,
  computeWageBill,
  countExpiringContracts,
  ensureRenewalDemands,
  getWageBudgetForClub,
} from "./managerContracts";
import { createClubAttendanceData } from "./managerAttendance";
import { createManagerChallengeCup } from "./managerChallengeCup";
import { generateReserveSquad } from "./managerReserves";
import {
  generateLeagueListedPlayers,
  initClubFunds,
} from "./managerTransferLeague";
import { syncManagerInboxMessages } from "./managerInbox";

const CAREER_KEY = "27-0-manager-career";

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

  const wageBill = raw.wageBill ?? computeWageBill(contracts);
  const wageBudget = raw.wageBudget ?? getWageBudgetForClub(raw.club);

  let challengeCup = raw.challengeCup as ChallengeCupBracketState | undefined;
  if (!challengeCup?.matches?.length) {
    challengeCup = createManagerChallengeCup(raw.seed ?? "migrate", raw.club);
  }

  const attendanceData =
    raw.attendanceData ?? createClubAttendanceData(raw.club);

  const schedule = (raw.schedule ?? []).map((s) => ({
    ...s,
    id: s.id ?? `legacy-r${s.round}`,
    competition: s.competition ?? ("league" as const),
    label: s.label ?? `Round ${s.round} — League`,
  }));

  let career: ManagerCareer = {
    ...raw,
    gameWeek,
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
    gateIncomeHistory: raw.gateIncomeHistory ?? [],
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
        : generateReserveSquad(raw.seed ?? "migrate"),
    reserveResults: raw.reserveResults ?? [],
    lastReserveResult: raw.lastReserveResult ?? null,
    calledUpReserveIds: raw.calledUpReserveIds ?? [],
    playerRegistry: raw.playerRegistry ?? {},
    hubResultsExpanded: raw.hubResultsExpanded ?? false,
    leagueListedPlayers:
      raw.leagueListedPlayers ??
      generateLeagueListedPlayers(
        raw.club,
        raw.seed ?? "migrate",
        raw.gameWeek ?? 0
      ),
    playerTransferStatus: raw.playerTransferStatus ?? {},
    inboxMessages: raw.inboxMessages ?? [],
    clubFunds: raw.clubFunds ?? initClubFunds(raw.club),
    transferMarket:
      raw.transferMarket ??
      (raw.leagueListedPlayers ?? []).map((l) => l.playerId),
  };

  career = ensureRenewalDemands(career);
  return syncManagerInboxMessages(career);
}

export function loadManagerCareer(): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return null;
    return hydrateManagerCareer(JSON.parse(raw) as ManagerCareer);
  } catch {
    return null;
  }
}

export function saveManagerCareer(career: ManagerCareer): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CAREER_KEY,
    JSON.stringify({ ...career, updatedAt: new Date().toISOString() })
  );
}

export function deleteManagerCareer(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CAREER_KEY);
}

export function hasManagerCareer(): boolean {
  return !!loadManagerCareer();
}

export function createNewCareer(club: string): ManagerCareer {
  const config = getManagerClubConfig(club);
  const seed = `mgr-${club}-${Date.now()}`;
  const rosterIds = getManagerRosterIds(club);
  const lineup = getManagerLineupForClub(club);
  const squad = rosterIds.map((id) => createInitialPlayerState(id));
  const startingIds = new Set(lineup.xiiiIds);
  const contracts = buildContractsForSquad(rosterIds, startingIds, club);
  const wageBill = computeWageBill(contracts);
  const wageBudget = getWageBudgetForClub(club);

  const schedule = buildManagerSchedule(club, seed);
  const squadIdSet = new Set(squad.map((p) => p.playerId));
  const leagueListed = generateLeagueListedPlayers(club, seed, 0);

  const career: ManagerCareer = {
    id: seed,
    club,
    seasonYear: new Date().getFullYear(),
    seed,
    budget: config.budget,
    clubFundsEarned: 0,
    boardConfidence: 65,
    boardExpectation: config.expectation,
    difficulty: config.difficulty,
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
    transferMarket: leagueListed.map((l) => l.playerId),
    leagueListedPlayers: leagueListed,
    playerTransferStatus: {},
    inboxMessages: [],
    clubFunds: initClubFunds(club),
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
    reserves: generateReserveSquad(seed),
    reserveResults: [],
    lastReserveResult: null,
    calledUpReserveIds: [],
    playerRegistry: {},
    hubResultsExpanded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveManagerCareer(career);
  return career;
}

export { buildSeasonSummary, advanceToNextSeason } from "./managerStateSeason";

export { CAREER_KEY };
