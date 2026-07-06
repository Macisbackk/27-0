import { findBestPosition, buildSquadFromIds } from "../game/engine";

import { getPeriodKey } from "../leaderboard";

import {
  applyPlayoffLifetimeUpdate,
  applySeasonLifetimeUpdate,
  type PlayoffLifetimeInput,
  type SeasonLifetimeInput,
} from "../lifetime-stats";

import { computeClubStats, mergeClubStats } from "../stats-helpers";

import type { GameDifficulty, ModeVariant, UserStatsData } from "../types";

import { isLoggedIn } from "../auth-session";

import { STORAGE_KEYS, STATS_SCHEMA_VERSION } from "./keys";
import { normalizeModeVariant } from "../mode-variant";



export const EMPTY_STATS: UserStatsData = {

  totalRuns: 0,

  highestSquadValue: 0,

  lowestSquadValue: null,

  averageSquadValue: 0,

  bestPositionFilled: null,

  bestPositionValue: 0,

  weeklyBest: 0,

  monthlyBest: 0,

  mostValuablePlayerEverPulled: null,

  mostValuablePlayerEverPulledVal: 0,

  bestBradfordSquad: 0,

  bestWiganSquad: 0,

  bestLeedsSquad: 0,

  bestStHelensSquad: 0,

  bestHistoricSquad: 0,

  totalSeasonsSimulated: 0,

  totalWins: 0,

  totalLosses: 0,

  seasonWins: 0,

  seasonLosses: 0,

  bestRecordWins: 0,

  bestRecordLosses: 0,

  worstRecordWins: 0,

  worstRecordLosses: 0,

  longestUnbeatenRun: 0,

  longestLosingStreak: 0,

  leagueTitlesWon: 0,

  totalPerfectSeasons: 0,

  totalWinlessSeasons: 0,

  bestNationalRanking: null,

  averageSeasonFinish: 0,

  draftCounts: {},

  playerSeasonWins: {},

  playerSeasonLosses: {},

  joeMellorRuns: 0,

  bestJoeMellorWins: 0,

  bestJoeMellorLosses: 0,

  joeMellorPerfectSeasons: 0,

  totalRerollsUsed: 0,

  mostRerollsInRun: 0,

  averageRerollsPerRun: 0,

  challengeCupRuns: 0,

  challengeCupWins: 0,

  challengeCupLosses: 0,

  challengeCupsWon: 0,

  challengeCupFinals: 0,

  challengeCupSemiFinals: 0,

  challengeCupQuarterFinals: 0,

  bestCupFinish: null,

  bestCupNationalRanking: null,

  highestCupSquadRating: null,

  lowestCupSquadRating: null,

  longestCupMatchWinStreak: 0,

  currentCupMatchWinStreak: 0,

  longestTournamentWinsInRow: 0,

  currentTournamentWinsInRow: 0,

  bestCupMatchWinsInTournament: 0,

  bestTeamRating: 0,

  regularSeasonWins: 0,
  regularSeasonLosses: 0,
  playoffWins: 0,
  playoffLosses: 0,
  topSixFinishes: 0,
  playoffAppearances: 0,
  playoffEliminatorWins: 0,
  playoffSemiFinalWins: 0,
  grandFinalAppearances: 0,
  superLeagueTitles: 0,
  bestOverallSeasonWins: 0,
  bestOverallSeasonLosses: 0,

};



interface StoredStats {

  normal: UserStatsData;

  hard: UserStatsData;

  draftNormal: UserStatsData;

  draftHard: UserStatsData;

  fantasy: UserStatsData;

  /** Normal Mode Era variant — separate from current `normal` bucket. */
  eraNormal: UserStatsData;

}



import { mergeUserStatsData } from "./merge-user-stats";



export type { StoredStats };



/** Merge cloud stats with local saves cumulatively per bucket. */
export function mergeCloudStatsWithLocal(
  cloud: StoredStats,
  local: StoredStats
): StoredStats {
  return {
    normal: mergeUserStatsData(cloud.normal, local.normal),
    hard: mergeUserStatsData(cloud.hard, local.hard),
    draftNormal: mergeUserStatsData(cloud.draftNormal, local.draftNormal),
    draftHard: mergeUserStatsData(cloud.draftHard, local.draftHard),
    fantasy: mergeUserStatsData(cloud.fantasy, local.fantasy),
    eraNormal: mergeUserStatsData(cloud.eraNormal, local.eraNormal),
  };
}

const STORED_STATS_KEYS: (keyof StoredStats)[] = [
  "normal",
  "hard",
  "draftNormal",
  "draftHard",
  "fantasy",
  "eraNormal",
];

/** Fingerprint cumulative counters used to detect duplicate cloud/local snapshots. */
function userStatsSyncSignature(stats: UserStatsData): string {
  const s = migrateUserStats(stats);
  return [
    s.totalSeasonsSimulated,
    s.totalRuns,
    s.seasonWins,
    s.seasonLosses,
    s.leagueTitlesWon,
    s.superLeagueTitles,
    s.totalPerfectSeasons,
  ].join(":");
}

function userStatsSyncEqual(a: UserStatsData, b: UserStatsData): boolean {
  return userStatsSyncSignature(a) === userStatsSyncSignature(b);
}

function userStatsRicher(
  a: UserStatsData,
  b: UserStatsData
): UserStatsData {
  if (a.totalSeasonsSimulated !== b.totalSeasonsSimulated) {
    return a.totalSeasonsSimulated > b.totalSeasonsSimulated ? a : b;
  }
  const aGames = a.seasonWins + a.seasonLosses;
  const bGames = b.seasonWins + b.seasonLosses;
  if (aGames !== bGames) return aGames > bGames ? a : b;
  if (a.totalRuns !== b.totalRuns) return a.totalRuns > b.totalRuns ? a : b;
  return a;
}

/**
 * Reconcile cloud and local stats without double-counting identical snapshots.
 */
export function reconcileUserStats(
  cloud: UserStatsData,
  local: UserStatsData
): UserStatsData {
  const c = migrateUserStats(cloud);
  const l = migrateUserStats(local);

  if (userStatsSyncEqual(c, l)) return c;

  const localEmpty =
    l.totalSeasonsSimulated === 0 &&
    l.totalRuns === 0 &&
    l.seasonWins + l.seasonLosses === 0;
  const cloudEmpty =
    c.totalSeasonsSimulated === 0 &&
    c.totalRuns === 0 &&
    c.seasonWins + c.seasonLosses === 0;

  if (localEmpty) return c;
  if (cloudEmpty) return l;

  return userStatsRicher(c, l);
}

export function reconcileStoredStats(
  cloud: StoredStats | null,
  local: StoredStats
): StoredStats {
  if (!cloud) return local;

  const result = {} as StoredStats;
  for (const key of STORED_STATS_KEYS) {
    result[key] = reconcileUserStats(cloud[key], local[key]);
  }
  return result;
}

export function storedStatsDifferFromCloud(
  cloud: StoredStats,
  reconciled: StoredStats
): boolean {
  return STORED_STATS_KEYS.some(
    (key) => !userStatsSyncEqual(reconciled[key], cloud[key])
  );
}



export type StatsBucket = keyof StoredStats;



export function resolveStatsBucket(

  mode: import("../types").GameMode,

  difficulty: GameDifficulty,

  modeVariant: ModeVariant = "current"

): StatsBucket {

  if (mode === "DRAFT") {

    return difficulty === "HARD" ? "draftHard" : "draftNormal";

  }

  if (mode === "FANTASY") {

    return "fantasy";

  }

  if (mode === "CLASSIC" && normalizeModeVariant(modeVariant) === "era") {

    return "eraNormal";

  }

  return difficulty === "HARD" ? "hard" : "normal";

}



/** Migrate legacy saves to split season/cup win tracking. */

export function migrateUserStats(raw: Partial<UserStatsData>): UserStatsData {

  const merged = { ...EMPTY_STATS, ...raw };



  if (merged.seasonWins === 0 && merged.seasonLosses === 0) {

    const legacyWins = merged.totalWins ?? 0;

    const legacyLosses = merged.totalLosses ?? 0;

    const cupWins = merged.challengeCupWins ?? 0;

    const cupLosses = merged.challengeCupLosses ?? 0;



    if (cupWins > 0 || cupLosses > 0) {

      merged.seasonWins = Math.max(0, legacyWins - cupWins);

      merged.seasonLosses = Math.max(0, legacyLosses - cupLosses);

    } else if (merged.totalSeasonsSimulated > 0 || legacyWins > 0) {

      merged.seasonWins = legacyWins;

      merged.seasonLosses = legacyLosses;

    }

  }



  merged.challengeCupWins = merged.challengeCupWins ?? 0;

  merged.challengeCupLosses = merged.challengeCupLosses ?? 0;

  merged.challengeCupQuarterFinals = merged.challengeCupQuarterFinals ?? 0;

  merged.bestCupNationalRanking = merged.bestCupNationalRanking ?? null;

  merged.highestCupSquadRating = merged.highestCupSquadRating ?? null;

  merged.lowestCupSquadRating = merged.lowestCupSquadRating ?? null;

  merged.longestCupMatchWinStreak = merged.longestCupMatchWinStreak ?? 0;

  merged.currentCupMatchWinStreak = merged.currentCupMatchWinStreak ?? 0;

  merged.longestTournamentWinsInRow = merged.longestTournamentWinsInRow ?? 0;

  merged.currentTournamentWinsInRow = merged.currentTournamentWinsInRow ?? 0;

  merged.bestCupMatchWinsInTournament = merged.bestCupMatchWinsInTournament ?? 0;

  merged.bestTeamRating = merged.bestTeamRating ?? 0;

  return sanitizeUserStatInts(merged);

}



function roundUserStatInt(value: number | undefined | null): number {
  const n = value ?? 0;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function sanitizeUserStatInts(stats: UserStatsData): UserStatsData {
  return {
    ...stats,
    totalRuns: roundUserStatInt(stats.totalRuns),
    highestSquadValue: roundUserStatInt(stats.highestSquadValue),
    lowestSquadValue:
      stats.lowestSquadValue === null
        ? null
        : roundUserStatInt(stats.lowestSquadValue),
    averageSquadValue: roundUserStatInt(stats.averageSquadValue),
    bestPositionValue: roundUserStatInt(stats.bestPositionValue),
    weeklyBest: roundUserStatInt(stats.weeklyBest),
    monthlyBest: roundUserStatInt(stats.monthlyBest),
    mostValuablePlayerEverPulledVal: roundUserStatInt(
      stats.mostValuablePlayerEverPulledVal
    ),
    bestBradfordSquad: roundUserStatInt(stats.bestBradfordSquad),
    bestWiganSquad: roundUserStatInt(stats.bestWiganSquad),
    bestLeedsSquad: roundUserStatInt(stats.bestLeedsSquad),
    bestStHelensSquad: roundUserStatInt(stats.bestStHelensSquad),
    bestHistoricSquad: roundUserStatInt(stats.bestHistoricSquad),
    totalSeasonsSimulated: roundUserStatInt(stats.totalSeasonsSimulated),
    totalWins: roundUserStatInt(stats.totalWins),
    totalLosses: roundUserStatInt(stats.totalLosses),
    seasonWins: roundUserStatInt(stats.seasonWins),
    seasonLosses: roundUserStatInt(stats.seasonLosses),
    bestRecordWins: roundUserStatInt(stats.bestRecordWins),
    bestRecordLosses: roundUserStatInt(stats.bestRecordLosses),
    worstRecordWins: roundUserStatInt(stats.worstRecordWins),
    worstRecordLosses: roundUserStatInt(stats.worstRecordLosses),
    longestUnbeatenRun: roundUserStatInt(stats.longestUnbeatenRun),
    longestLosingStreak: roundUserStatInt(stats.longestLosingStreak),
    leagueTitlesWon: roundUserStatInt(stats.leagueTitlesWon),
    totalPerfectSeasons: roundUserStatInt(stats.totalPerfectSeasons),
    totalWinlessSeasons: roundUserStatInt(stats.totalWinlessSeasons),
    averageSeasonFinish: roundUserStatInt(stats.averageSeasonFinish),
    joeMellorRuns: roundUserStatInt(stats.joeMellorRuns),
    bestJoeMellorWins: roundUserStatInt(stats.bestJoeMellorWins),
    bestJoeMellorLosses: roundUserStatInt(stats.bestJoeMellorLosses),
    joeMellorPerfectSeasons: roundUserStatInt(stats.joeMellorPerfectSeasons),
    totalRerollsUsed: roundUserStatInt(stats.totalRerollsUsed),
    mostRerollsInRun: roundUserStatInt(stats.mostRerollsInRun),
    averageRerollsPerRun: roundUserStatInt(stats.averageRerollsPerRun),
    challengeCupRuns: roundUserStatInt(stats.challengeCupRuns),
    challengeCupWins: roundUserStatInt(stats.challengeCupWins),
    challengeCupLosses: roundUserStatInt(stats.challengeCupLosses),
    challengeCupsWon: roundUserStatInt(stats.challengeCupsWon),
    challengeCupFinals: roundUserStatInt(stats.challengeCupFinals),
    challengeCupSemiFinals: roundUserStatInt(stats.challengeCupSemiFinals),
    challengeCupQuarterFinals: roundUserStatInt(stats.challengeCupQuarterFinals),
    longestCupMatchWinStreak: roundUserStatInt(stats.longestCupMatchWinStreak),
    currentCupMatchWinStreak: roundUserStatInt(stats.currentCupMatchWinStreak),
    longestTournamentWinsInRow: roundUserStatInt(stats.longestTournamentWinsInRow),
    currentTournamentWinsInRow: roundUserStatInt(
      stats.currentTournamentWinsInRow
    ),
    bestCupMatchWinsInTournament: roundUserStatInt(
      stats.bestCupMatchWinsInTournament
    ),
    bestTeamRating: roundUserStatInt(stats.bestTeamRating),
    regularSeasonWins: roundUserStatInt(stats.regularSeasonWins),
    regularSeasonLosses: roundUserStatInt(stats.regularSeasonLosses),
    playoffWins: roundUserStatInt(stats.playoffWins),
    playoffLosses: roundUserStatInt(stats.playoffLosses),
    topSixFinishes: roundUserStatInt(stats.topSixFinishes),
    playoffAppearances: roundUserStatInt(stats.playoffAppearances),
    playoffEliminatorWins: roundUserStatInt(stats.playoffEliminatorWins),
    playoffSemiFinalWins: roundUserStatInt(stats.playoffSemiFinalWins),
    grandFinalAppearances: roundUserStatInt(stats.grandFinalAppearances),
    superLeagueTitles: roundUserStatInt(stats.superLeagueTitles),
    bestOverallSeasonWins: roundUserStatInt(stats.bestOverallSeasonWins),
    bestOverallSeasonLosses: roundUserStatInt(stats.bestOverallSeasonLosses),
    bestNationalRanking:
      stats.bestNationalRanking === null
        ? null
        : roundUserStatInt(stats.bestNationalRanking),
    bestCupNationalRanking:
      stats.bestCupNationalRanking === null
        ? null
        : roundUserStatInt(stats.bestCupNationalRanking),
    highestCupSquadRating:
      stats.highestCupSquadRating === null
        ? null
        : roundUserStatInt(stats.highestCupSquadRating),
    lowestCupSquadRating:
      stats.lowestCupSquadRating === null
        ? null
        : roundUserStatInt(stats.lowestCupSquadRating),
  };
}



function emptyStoredStats(): StoredStats {
  return {
    normal: { ...EMPTY_STATS },
    hard: { ...EMPTY_STATS },
    draftNormal: { ...EMPTY_STATS },
    draftHard: { ...EMPTY_STATS },
    fantasy: { ...EMPTY_STATS },
    eraNormal: { ...EMPTY_STATS },
  };
}

function hydrateStoredStats(raw: Partial<StoredStats>): StoredStats {
  return {
    normal: migrateUserStats(raw.normal ?? {}),
    hard: migrateUserStats(raw.hard ?? {}),
    draftNormal: migrateUserStats(raw.draftNormal ?? {}),
    draftHard: migrateUserStats(raw.draftHard ?? {}),
    fantasy: migrateUserStats(raw.fantasy ?? {}),
    eraNormal: migrateUserStats(raw.eraNormal ?? {}),
  };
}

function purgeLegacyCupLocalStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("27-0-cup-leaderboard");
  localStorage.removeItem("27-0-era-cup-leaderboard");
}

function stripLegacyEraCupStatsBucket(): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEYS.stats);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!("eraCup" in parsed)) return;
    delete parsed.eraCup;
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function ensureStatsSchemaVersion(): void {
  if (typeof window === "undefined") return;
  const version = Number.parseInt(
    localStorage.getItem(STORAGE_KEYS.statsSchemaVersion) ?? "1",
    10
  );
  if (version < STATS_SCHEMA_VERSION) {
    purgeLegacyCupLocalStorage();
    stripLegacyEraCupStatsBucket();
  }
  if (version >= STATS_SCHEMA_VERSION) return;
  localStorage.setItem(
    STORAGE_KEYS.statsSchemaVersion,
    String(STATS_SCHEMA_VERSION)
  );
}

function loadStoredStats(): StoredStats {

  if (typeof window === "undefined") {
    return emptyStoredStats();
  }

  ensureStatsSchemaVersion();

  try {

    const raw = localStorage.getItem(STORAGE_KEYS.stats);

    if (!raw) {
      return emptyStoredStats();
    }

    const parsed = JSON.parse(raw) as Partial<StoredStats> & Partial<UserStatsData>;

    if (parsed.normal || parsed.hard) {
      return hydrateStoredStats(parsed);
    }

    return {
      ...emptyStoredStats(),
      normal: migrateUserStats(parsed),
    };

  } catch {

    return emptyStoredStats();

  }

}



function saveStoredStats(data: StoredStats): void {

  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(data));

  if (isLoggedIn()) {
    void import("./stats-cloud").then(({ saveCloudStats }) => saveCloudStats(data));
  }

}



export function getStats(

  difficulty: GameDifficulty = "NORMAL",

  bucket?: StatsBucket

): UserStatsData {

  const stored = loadStoredStats();

  const key = bucket ?? (difficulty === "HARD" ? "hard" : "normal");

  return stored[key];

}



export function getClassicStats(

  difficulty: GameDifficulty = "NORMAL"

): UserStatsData {

  return getStats(difficulty, difficulty === "HARD" ? "hard" : "normal");

}



export function getDraftStats(

  difficulty: GameDifficulty = "NORMAL"

): UserStatsData {

  return getStats(

    difficulty,

    difficulty === "HARD" ? "draftHard" : "draftNormal"

  );

}



export function getAllStats(): StoredStats {

  return loadStoredStats();

}

export async function refreshCareerStatsFromCloud(): Promise<boolean> {
  if (typeof window === "undefined" || !isLoggedIn()) return false;

  const { loadCloudStats, saveCloudStats } = await import("./stats-cloud");
  const cloud = await loadCloudStats();
  const local = getAllStats();

  if (!cloud) {
    await saveCloudStats(local);
    window.dispatchEvent(new Event("stats-merged"));
    return true;
  }

  const reconciled = reconcileStoredStats(cloud, local);
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(reconciled));

  if (storedStatsDifferFromCloud(cloud, reconciled)) {
    await saveCloudStats(reconciled);
  }

  window.dispatchEvent(new Event("stats-merged"));
  return true;
}

export async function flushCareerStatsToCloud(): Promise<void> {
  if (typeof window === "undefined" || !isLoggedIn()) return;
  const { saveCloudStats } = await import("./stats-cloud");
  await saveCloudStats(getAllStats());
}

/** Clears Quick Mode career stats locally and in the cloud when logged in. */
export async function resetCareerStats(): Promise<{ ok: boolean; error?: string }> {
  const empty = emptyStoredStats();

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(empty));
    window.dispatchEvent(new Event("stats-merged"));
  }

  if (!isLoggedIn()) {
    return { ok: true };
  }

  try {
    const { saveCloudStats } = await import("./stats-cloud");
    await saveCloudStats(empty);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Local stats were cleared but cloud reset failed. Try again.",
    };
  }
}



export function updateRerollStats(

  rerollsUsed: number,

  difficulty: GameDifficulty = "NORMAL",

  bucket: StatsBucket = "normal"

): UserStatsData {

  if (difficulty === "HARD" || bucket.startsWith("draft")) {

    return getStats(difficulty, bucket);

  }



  const stored = loadStoredStats();

  const existing = stored[bucket];

  const newTotalRuns = existing.totalRuns;

  const newTotalRerolls = existing.totalRerollsUsed + rerollsUsed;

  const newAverage =
    newTotalRuns > 0 ? Math.round(newTotalRerolls / newTotalRuns) : 0;



  const updated: UserStatsData = {

    ...existing,

    totalRerollsUsed: newTotalRerolls,

    mostRerollsInRun: Math.max(existing.mostRerollsInRun, rerollsUsed),

    averageRerollsPerRun: newAverage,

  };



  stored[bucket] = updated;

  saveStoredStats(stored);

  return updated;

}



export function updateStats(

  signedIds: string[],

  totalValue: number,

  difficulty: GameDifficulty = "NORMAL",

  achievedAt = new Date(),

  bucket: StatsBucket = "normal"

): UserStatsData {

  const stored = loadStoredStats();

  const existing = stored[bucket];

  const squad = buildSquadFromIds(signedIds);

  const bestPosition = findBestPosition(squad);

  const clubStats = computeClubStats(signedIds);

  const merged = mergeClubStats(

    {

      bestBradfordSquad: existing.bestBradfordSquad,

      bestWiganSquad: existing.bestWiganSquad,

      bestLeedsSquad: existing.bestLeedsSquad,

      bestStHelensSquad: existing.bestStHelensSquad,

      bestHistoricSquad: existing.bestHistoricSquad,

      mostValuablePlayerEverPulled: existing.mostValuablePlayerEverPulled,

      mostValuablePlayerEverPulledVal:

        existing.mostValuablePlayerEverPulledVal,

    },

    clubStats

  );



  const newTotalRuns = existing.totalRuns + 1;

  const newAverage = Math.round(

    (existing.averageSquadValue * existing.totalRuns + totalValue) /

      newTotalRuns

  );



  const updated: UserStatsData = {

    ...existing,

    totalRuns: newTotalRuns,

    highestSquadValue: Math.max(existing.highestSquadValue, totalValue),

    averageSquadValue: newAverage,

    bestPositionFilled:

      bestPosition.value > existing.bestPositionValue

        ? bestPosition.position

        : existing.bestPositionFilled,

    bestPositionValue: Math.max(

      existing.bestPositionValue,

      bestPosition.value

    ),

    weeklyBest:

      getPeriodKey("WEEKLY", achievedAt) === getPeriodKey("WEEKLY")

        ? Math.max(existing.weeklyBest, totalValue)

        : existing.weeklyBest,

    monthlyBest:

      getPeriodKey("MONTHLY", achievedAt) === getPeriodKey("MONTHLY")

        ? Math.max(existing.monthlyBest, totalValue)

        : existing.monthlyBest,

    ...merged,

  };



  stored[bucket] = updated;

  saveStoredStats(stored);

  return updated;

}



export function updatePlayoffLifetimeStats(
  input: PlayoffLifetimeInput,
  difficulty: GameDifficulty = "NORMAL",
  bucket: StatsBucket = "normal"
): UserStatsData {
  const stored = loadStoredStats();
  const existing = stored[bucket];
  const updated = applyPlayoffLifetimeUpdate(existing, input);
  stored[bucket] = updated;
  saveStoredStats(stored);
  return updated;
}

export function updateSeasonLifetimeStats(

  input: SeasonLifetimeInput,

  difficulty: GameDifficulty = "NORMAL",

  bucket: StatsBucket = "normal"

): UserStatsData {

  const stored = loadStoredStats();

  const existing = stored[bucket];

  const updated = applySeasonLifetimeUpdate(existing, input);



  stored[bucket] = updated;

  saveStoredStats(stored);

  return updated;

}



/** @deprecated Use updateSeasonLifetimeStats — kept for compatibility */

export function updateJoeMellorStats(

  wins: number,

  losses: number,

  isPerfect: boolean

): UserStatsData {

  return updateSeasonLifetimeStats({

    wins,

    losses,

    leaguePosition: 1,

    isPerfect,

    longestWinStreak: wins,

    longestLosingStreak: losses,

    signedIds: [],

    totalValue: 0,

    joeMellorMode: true,

  });

}

