import { CHALLENGE_CUP_SCHEMA_VERSION } from "./championship/championshipChallengeCup";
import {
  buildDefaultLineup,
  getManagerClubConfig,
  MANAGER_EXPECTATION_LABELS,
  type ManagerClubExpectationTier,
} from "./club-config";
import { createManagerChallengeCup, cupSeedingInputFromCareer } from "./managerChallengeCup";
import {
  buildLeagueTableFromMatches,
  buildManagerSchedule,
  buildManagerScheduleFromChampionship,
} from "./managerFixtures";
import {
  getLeagueClubPlayerContract,
  getWageBudgetForClub,
} from "./managerContracts";
import { createClubAttendanceData, syncClubAttendanceData } from "./managerAttendance";
import { ensureClubFacilities, getEffectiveStadiumCapacity } from "./managerFacilities";
import {
  getLeagueClubRosterIds,
  reconcileLeagueRosters,
} from "./managerLeagueRosters";
import { pushInboxMessage } from "./managerInbox";
import { getManagerRosterIds } from "./managerRating";
import { createInitialPlayerState } from "./managerSquad";
import { snapshotSquadSeasonStartRatings } from "./managerPlayerDevelopment";
import { buildReserveContractsForReserves, computeCareerWageBill } from "./managerReserveContracts";
import {
  generateReserveSquad,
  initLeagueClubReserveCounts,
} from "./managerReserves";
import {
  getUserLeagueClubs,
  getUserSeasonGames,
  isUserInChampionship,
} from "./leagueMembership";
import type {
  ManagerCareer,
  ManagerCareerHistoryEntry,
  ManagerReservePlayer,
  PlayerContract,
} from "./types";
import { normalizeMatchdayLineup } from "./matchday-lineup";

export const MANAGER_CAREER_WORLD_SCHEMA_VERSION = 2;

export function managerClubSeasonKey(career: ManagerCareer): string {
  return `${career.club}-${career.seasonYear}`;
}

export function migrateCareerHistory(career: ManagerCareer): ManagerCareer {
  const managerId = career.managerId ?? career.id;
  const worldSaveId = career.worldSaveId ?? career.id;
  const userControlledClubId = career.userControlledClubId ?? career.club;

  let history = career.managerCareerHistory ?? [];
  if (history.length === 0) {
    const entry: ManagerCareerHistoryEntry = {
      id: `hist-${managerId}-${career.club}`,
      clubId: career.club,
      clubName: career.club,
      joinedSeason: career.seasonYear,
      joinedWeek: career.gameWeek ?? 0,
      joinedDate: career.createdAt ?? new Date().toISOString(),
      boardExpectationAtJoin: career.boardExpectation,
    };
    history = [entry];
  }

  return {
    ...career,
    managerId,
    worldSaveId,
    userControlledClubId,
    managerCareerHistory: history,
    managerCareerWorldSchemaVersion:
      career.managerCareerWorldSchemaVersion ?? MANAGER_CAREER_WORLD_SCHEMA_VERSION,
    boostUsage: career.boostUsage ?? {},
    boardSackingSchemaVersion: career.boardSackingSchemaVersion ?? 1,
  };
}

function closeActiveHistoryEntry(
  history: ManagerCareerHistoryEntry[],
  career: ManagerCareer,
  departureReason: ManagerCareerHistoryEntry["departureReason"]
): ManagerCareerHistoryEntry[] {
  const now = new Date().toISOString();
  return history.map((entry) => {
    if (entry.leftDate || entry.clubId !== career.club) return entry;
    return {
      ...entry,
      leftSeason: career.seasonYear,
      leftWeek: career.gameWeek,
      leftDate: now,
      departureReason,
      finalBoardConfidence: career.boardConfidence,
    };
  });
}

function softenExpectationTier(
  tier: ManagerClubExpectationTier
): ManagerClubExpectationTier {
  const map: Record<ManagerClubExpectationTier, ManagerClubExpectationTier> = {
    title: "top",
    top: "playoffs",
    playoffs: "mid-table",
    "mid-table": "avoid-bottom",
    "avoid-bottom": "survive",
    survive: "survive",
  };
  return map[tier];
}

function boardExpectationForTakeover(
  career: ManagerCareer,
  club: string,
  gameWeek: number
): string {
  const config = getManagerClubConfig(club);
  const seasonGames = getUserSeasonGames(career);
  if (gameWeek < Math.floor(seasonGames * 0.65)) {
    return config.expectation;
  }
  const softerTier = softenExpectationTier(config.expectationTier);
  return MANAGER_EXPECTATION_LABELS[softerTier];
}

export interface ContinuationClubSummary {
  club: string;
  position: number;
  squadRating: number;
  budget: number;
  boardExpectation: string;
  difficulty: number;
  primaryColor: string;
  secondaryColor: string;
}

export function listContinuationClubs(
  career: ManagerCareer
): ContinuationClubSummary[] {
  return getUserLeagueClubs(career)
    .filter((club) => club !== career.club)
    .map((club) => {
      const config = getManagerClubConfig(club);
      const row = career.leagueTable.find((r) => r.team === club);
      return {
        club,
        position: row?.position ?? 8,
        squadRating: config.squadRating,
        budget: career.clubFunds[club] ?? config.budget,
        boardExpectation: boardExpectationForTakeover(
          career,
          club,
          career.gameWeek
        ),
        difficulty: config.difficulty,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
      };
    });
}

function syncUserSquadToLeagueRoster(career: ManagerCareer): ManagerCareer {
  const rosters = {
    ...(career.leagueClubRosters ?? {}),
    [career.club]: career.squad.map((p) => p.playerId),
  };
  const leagueClubReserves: Record<string, ManagerReservePlayer[]> = {
    ...(career.leagueClubReserves ?? {}),
    [career.club]: career.reserves.map((r) => ({ ...r })),
  };
  const leagueClubReserveCounts = {
    ...(career.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
    [career.club]: career.reserves.length,
  };
  return {
    ...career,
    leagueClubRosters: rosters,
    leagueClubReserves,
    leagueClubReserveCounts,
  };
}

function resolveTakeoverReserves(
  career: ManagerCareer,
  newClub: string
): ManagerReservePlayer[] {
  const stored = career.leagueClubReserves?.[newClub];
  if (stored && stored.length > 0) {
    return stored.map((r) => ({ ...r }));
  }
  const count =
    career.leagueClubReserveCounts?.[newClub] ??
    initLeagueClubReserveCounts()[newClub] ??
    24;
  return generateReserveSquad(
    career.seed,
    count,
    newClub,
    career.seasonYear
  );
}

export function takeOverClub(
  career: ManagerCareer,
  newClub: string,
  reason: "sacked" | "resigned" | "club-change" = "club-change"
): ManagerCareer {
  if (newClub === career.club) return career;
  const leagueClubs = getUserLeagueClubs(career);
  if (!leagueClubs.includes(newClub)) {
    return career;
  }

  let next = syncUserSquadToLeagueRoster(career);

  const closedHistory = closeActiveHistoryEntry(
    next.managerCareerHistory ?? [],
    next,
    reason
  );

  const rosterIds = getLeagueClubRosterIds(next, newClub);
  const fallbackIds =
    rosterIds.length > 0
      ? rosterIds
      : isUserInChampionship(next)
        ? []
        : [...getManagerRosterIds(newClub)];
  if (fallbackIds.length === 0) return career;

  const lineup =
    buildDefaultLineup(fallbackIds) ??
    buildDefaultLineup(
      isUserInChampionship(next)
        ? fallbackIds
        : getManagerRosterIds(newClub)
    );
  const squad = fallbackIds.map((id) => createInitialPlayerState(id));

  const startingIds = new Set(lineup?.xiiiIds ?? fallbackIds.slice(0, 13));
  const contracts: Record<string, PlayerContract> = {};
  for (const playerId of fallbackIds) {
    contracts[playerId] = getLeagueClubPlayerContract(next, newClub, playerId, {
      inStartingXiii: startingIds.has(playerId),
    });
  }

  const config = getManagerClubConfig(newClub);
  const clubFacilities = ensureClubFacilities(next.clubFacilities);
  const attendanceData = syncClubAttendanceData(
    newClub,
    createClubAttendanceData(newClub),
    clubFacilities
  );
  attendanceData.stadiumCapacity = getEffectiveStadiumCapacity(
    newClub,
    clubFacilities
  );

  const transferBudget =
    next.clubFunds[newClub] ??
    Math.round(config.budget * 0.75);
  const wageBudget = getWageBudgetForClub(newClub);
  const reserves = resolveTakeoverReserves(next, newClub);
  const reserveContracts = buildReserveContractsForReserves(reserves);

  const wageBill = computeCareerWageBill({
    ...next,
    squad,
    contracts,
    reserveContracts,
  } as ManagerCareer);

  const joinedDate = new Date().toISOString();
  const historyEntry: ManagerCareerHistoryEntry = {
    id: `hist-${next.managerId ?? next.id}-${newClub}-${next.seasonYear}`,
    clubId: newClub,
    clubName: newClub,
    joinedSeason: next.seasonYear,
    joinedWeek: next.gameWeek,
    joinedDate,
    boardExpectationAtJoin: boardExpectationForTakeover(
      next,
      newClub,
      next.gameWeek
    ),
  };

  next = {
    ...next,
    club: newClub,
    userControlledClubId: newClub,
    boardExpectation: boardExpectationForTakeover(
      next,
      newClub,
      next.gameWeek
    ),
    difficulty: config.difficulty,
    superLeagueDifficulty: isUserInChampionship(next)
      ? (next.superLeagueDifficulty ?? 1)
      : config.difficulty,
    championshipDifficulty: isUserInChampionship(next)
      ? Math.min(3, config.difficulty)
      : (next.championshipDifficulty ?? Math.min(3, config.difficulty)),
    prestigeMomentum: 0,
    clubStarRiseCelebratedAt: config.difficulty,
    squad,
    contracts,
    reserves,
    reserveContracts,
    calledUpReserveIds: [],
    reserveResults: [],
    lastReserveResult: null,
    youthProspects: [],
    matchdayXiii: lineup?.xiiiIds ?? fallbackIds.slice(0, 13),
    matchdayInterchange:
      lineup?.benchIds ?? fallbackIds.slice(13, 13 + 4),
    xiiiSlotPositions: lineup?.slotPositions ?? [],
    budget: transferBudget,
    wageBudget,
    wageBill,
    attendanceData,
    managerFinance: {
      ...next.managerFinance,
      transferBudget,
      wageBudget,
      wageBill,
      clubFunds: transferBudget + (next.managerFinance?.operatingBalance ?? 0),
    },
    boardConfidence: Math.min(65, Math.max(45, next.boardConfidence)),
    managerCareerHistory: [...closedHistory, historyEntry],
    playerTransferStatus: {},
    playerDevelopment: snapshotSquadSeasonStartRatings({
      ...next,
      club: newClub,
      squad,
    }),
    leagueTable: next.leagueTable.map((row) => ({
      ...row,
      isUserTeam: row.team === newClub,
    })),
    leagueClubReserves: {
      ...(next.leagueClubReserves ?? {}),
      [newClub]: reserves.map((r) => ({ ...r })),
    },
    leagueClubReserveCounts: {
      ...(next.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
      [newClub]: reserves.length,
    },
    updatedAt: joinedDate,
  };

  next = reconcileLeagueRosters(next);

  if (next.gameWeek === 0 && next.fixtures.length === 0) {
    const champComp = next.championshipCompetition;
    next = {
      ...next,
      schedule:
        isUserInChampionship(next) && champComp
          ? buildManagerScheduleFromChampionship(newClub, champComp, next.seed)
          : buildManagerSchedule(newClub, next.seed),
      challengeCup: createManagerChallengeCup(
        next.seed,
        newClub,
        cupSeedingInputFromCareer(next, {
          previousSeasonLeagueTable: next.previousSeasonLeagueTable,
          previousSeasonChampionshipTable: next.previousSeasonChampionshipTable,
        })
      ),
      challengeCupSchemaVersion: CHALLENGE_CUP_SCHEMA_VERSION,
      leagueTable: buildLeagueTableFromMatches([], newClub),
    };
  }

  next = normalizeMatchdayLineup(next);
  next = pushInboxMessage(next, {
    id: `board-welcome-${newClub}-${next.seasonYear}-${next.gameWeek}`,
    type: "board",
    title: `Welcome to ${newClub}`,
    body: `The ${newClub} board have appointed you with immediate effect. Target for the remainder of the season: ${next.boardExpectation}.`,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: joinedDate,
    read: false,
    sender: "Board",
  });

  return next;
}

export function getActiveCareerHistoryEntry(
  career: ManagerCareer
): ManagerCareerHistoryEntry | undefined {
  return (career.managerCareerHistory ?? []).find(
    (entry) => !entry.leftDate && entry.clubId === career.club
  );
}
