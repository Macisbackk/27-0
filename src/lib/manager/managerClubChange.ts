import seedrandom from "seedrandom";
import { CHALLENGE_CUP_SCHEMA_VERSION } from "./championship/championshipChallengeCup";
import {
  buildDefaultLineup,
  CHAMPIONSHIP_EXPECTATION_LABELS,
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
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  getUserCompetitionId,
  getUserLeagueClubs,
  isUserInChampionship,
  type ManagerCompetitionId,
} from "./leagueMembership";
import { getCareerClubStars } from "./managerDifficulty";
import type {
  ManagerCareer,
  ManagerCareerHistoryEntry,
  ManagerReservePlayer,
  PlayerContract,
} from "./types";
import { normalizeMatchdayLineup } from "./matchday-lineup";

export const MANAGER_CAREER_WORLD_SCHEMA_VERSION = 2;

const SACK_OFFER_COUNT = 3;

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

function expectationLabelsForCompetition(competition: ManagerCompetitionId) {
  return competition === "championship"
    ? CHAMPIONSHIP_EXPECTATION_LABELS
    : MANAGER_EXPECTATION_LABELS;
}

function boardExpectationForTakeover(
  career: ManagerCareer,
  club: string,
  gameWeek: number
): string {
  const config = getManagerClubConfig(club);
  const competition: ManagerCompetitionId =
    config.competition === "championship" ? "championship" : "super-league";
  const labels = expectationLabelsForCompetition(competition);
  const seasonGames =
    competition === "championship"
      ? getCareerChampionshipClubs(career).length * 2 - 2
      : getUserLeagueClubs(career).length * 2 - 2;
  if (gameWeek < Math.floor(Math.max(1, seasonGames) * 0.65)) {
    return config.expectation;
  }
  const softerTier = softenExpectationTier(config.expectationTier);
  return labels[softerTier];
}

/** Unified prestige so SL clubs rank above Championship clubs. */
export function clubPrestigeRank(
  club: string,
  competitionHint?: ManagerCompetitionId
): number {
  const config = getManagerClubConfig(club);
  const competition =
    competitionHint ??
    (config.competition === "championship" ? "championship" : "super-league");
  const stars = Math.max(1, Math.min(5, config.difficulty));
  return competition === "championship" ? stars : stars + 3;
}

export function careerPrestigeRank(career: ManagerCareer): number {
  const stars = getCareerClubStars(career);
  return isUserInChampionship(career) ? stars : stars + 3;
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
  competition: ManagerCompetitionId;
  prestigeRank: number;
}

function summarizeContinuationClub(
  career: ManagerCareer,
  club: string,
  competition: ManagerCompetitionId
): ContinuationClubSummary {
  const config = getManagerClubConfig(club);
  const table =
    competition === getUserCompetitionId(career)
      ? career.leagueTable
      : competition === "championship"
        ? career.championshipCompetition?.standings.map((s) => ({
            team: s.team,
            position: s.position,
          }))
        : career.aiSuperLeagueStandings?.map((s) => ({
            team: s.team,
            position: s.position,
          }));
  const row = table?.find((r) => r.team === club);
  return {
    club,
    position: row?.position ?? 99,
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
    competition,
    prestigeRank: clubPrestigeRank(club, competition),
  };
}

/** @deprecated Prefer listSackJobOffers for post-sack hiring. */
export function listContinuationClubs(
  career: ManagerCareer
): ContinuationClubSummary[] {
  const competition = getUserCompetitionId(career);
  return getUserLeagueClubs(career)
    .filter((club) => club !== career.club)
    .map((club) => summarizeContinuationClub(career, club, competition))
    .sort((a, b) => a.prestigeRank - b.prestigeRank || a.position - b.position);
}

/**
 * Post-sack job market: a few worse clubs only (SL + Championship),
 * never a free pick of peers at the same level or above.
 */
export function listSackJobOffers(
  career: ManagerCareer,
  count = SACK_OFFER_COUNT
): ContinuationClubSummary[] {
  const currentPrestige = careerPrestigeRank(career);
  const currentClub = career.club;
  const slClubs = getCareerSuperLeagueClubs(career);
  const champClubs = getCareerChampionshipClubs(career);

  const pool: ContinuationClubSummary[] = [
    ...slClubs.map((club) =>
      summarizeContinuationClub(career, club, "super-league")
    ),
    ...champClubs.map((club) =>
      summarizeContinuationClub(career, club, "championship")
    ),
  ].filter((row) => row.club !== currentClub);

  const worse = pool.filter((row) => row.prestigeRank < currentPrestige);
  // Same prestige only if squad OVR is clearly weaker — never better clubs.
  const sameTierWeaker = pool.filter(
    (row) =>
      row.prestigeRank === currentPrestige &&
      row.squadRating < (getManagerClubConfig(currentClub).squadRating ?? 80)
  );

  const candidates =
    worse.length >= count
      ? worse
      : [...worse, ...sameTierWeaker].slice(0, Math.max(count, worse.length));

  const rng = seedrandom(
    `${career.seed}-sack-offers-${career.seasonYear}-${career.club}-${currentPrestige}`
  );
  const shuffled = [...(candidates.length > 0 ? candidates : worse)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const preferred = shuffled.filter((row) => row.prestigeRank < currentPrestige);
  const rest = shuffled.filter((row) => row.prestigeRank === currentPrestige);
  const ordered = [...preferred, ...rest];
  return ordered.slice(0, Math.min(count, ordered.length));
}

function resolveClubCompetitionInWorld(
  career: ManagerCareer,
  club: string
): ManagerCompetitionId | null {
  if (getCareerSuperLeagueClubs(career).includes(club)) return "super-league";
  if (getCareerChampionshipClubs(career).includes(club)) return "championship";
  return null;
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
  const targetCompetition = resolveClubCompetitionInWorld(career, newClub);
  if (!targetCompetition) {
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
      : targetCompetition === "championship"
        ? []
        : [...getManagerRosterIds(newClub)];
  if (fallbackIds.length === 0) return career;

  const lineup =
    buildDefaultLineup(fallbackIds) ??
    buildDefaultLineup(
      targetCompetition === "championship"
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

  const leagueClubs =
    targetCompetition === "championship"
      ? getCareerChampionshipClubs(next)
      : getCareerSuperLeagueClubs(next);

  next = {
    ...next,
    club: newClub,
    userControlledClubId: newClub,
    userCompetitionId: targetCompetition,
    boardExpectation: boardExpectationForTakeover(
      next,
      newClub,
      next.gameWeek
    ),
    difficulty: config.difficulty,
    superLeagueDifficulty:
      targetCompetition === "super-league"
        ? config.difficulty
        : (next.superLeagueDifficulty ?? 1),
    championshipDifficulty:
      targetCompetition === "championship"
        ? Math.min(3, config.difficulty)
        : (next.championshipDifficulty ?? Math.min(3, config.difficulty)),
    prestigeMomentum: 0,
    clubStarRiseCelebratedAt: config.difficulty,
    pendingClubStarRiseFrom: undefined,
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
    leagueTable: buildLeagueTableFromMatches([], newClub, leagueClubs),
    leagueClubReserves: {
      ...(next.leagueClubReserves ?? {}),
      [newClub]: reserves.map((r) => ({ ...r })),
    },
    leagueClubReserveCounts: {
      ...(next.leagueClubReserveCounts ?? initLeagueClubReserveCounts()),
      [newClub]: reserves.length,
    },
    // Clear end-of-season / previous-club celebration state for the new job.
    isSeasonComplete: false,
    matchWeekPhase: "ready_to_play",
    pendingMatchWeekId: null,
    boardSeasonEvaluation: undefined,
    boardSeasonEvaluations: undefined,
    playoffs: undefined,
    playoffsIntroAcknowledged: false,
    trophyCelebrationShown: false,
    leagueWinnersCelebrationShown: false,
    promotionCelebrationShown: false,
    objectivesIntroShown: false,
    updatedAt: joinedDate,
  };

  next = reconcileLeagueRosters(next);

  // Always rebuild the new club's remaining/new-season schedule when taking over
  // at season start; mid-season same-league takeovers keep existing fixtures.
  const rebuildSchedule =
    next.gameWeek === 0 ||
    targetCompetition !== getUserCompetitionId(career) ||
    next.fixtures.length === 0;

  if (rebuildSchedule) {
    const champComp = next.championshipCompetition;
    next = {
      ...next,
      fixtures: [],
      roundMatches: [],
      currentRound: 0,
      currentFixtureIndex: 0,
      gameWeek: next.gameWeek === 0 ? 0 : next.gameWeek,
      wins: next.gameWeek === 0 ? 0 : next.wins,
      losses: next.gameWeek === 0 ? 0 : next.losses,
      draws: next.gameWeek === 0 ? 0 : next.draws,
      schedule:
        targetCompetition === "championship" && champComp
          ? buildManagerScheduleFromChampionship(newClub, champComp, next.seed)
          : buildManagerSchedule(newClub, next.seed, {
              clubs: getCareerSuperLeagueClubs(next),
            }),
      challengeCup: createManagerChallengeCup(
        next.seed,
        newClub,
        cupSeedingInputFromCareer(next, {
          previousSeasonLeagueTable: next.previousSeasonLeagueTable,
          previousSeasonChampionshipTable: next.previousSeasonChampionshipTable,
        })
      ),
      challengeCupSchemaVersion: CHALLENGE_CUP_SCHEMA_VERSION,
      leagueTable: buildLeagueTableFromMatches([], newClub, leagueClubs),
    };
  }

  next = normalizeMatchdayLineup(next);
  next = pushInboxMessage(next, {
    id: `board-welcome-${newClub}-${next.seasonYear}-${next.gameWeek}`,
    type: "board",
    title: `Welcome to ${newClub}`,
    body: `The ${newClub} board have appointed you with immediate effect. Target: ${next.boardExpectation}.`,
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
