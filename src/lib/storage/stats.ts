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

  eraChallengeCupRuns: 0,

  eraChallengeCupWins: 0,

  eraChallengeCupLosses: 0,

  eraCupsWon: 0,

  eraMatchWins: 0,

  eraMatchLosses: 0,

  bestEraTeamUsed: null,

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

  eraCup: UserStatsData;

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
    eraCup: mergeUserStatsData(cloud.eraCup, local.eraCup),
    eraNormal: mergeUserStatsData(cloud.eraNormal, local.eraNormal),
  };
}

const STORED_STATS_KEYS: (keyof StoredStats)[] = [
  "normal",
  "hard",
  "draftNormal",
  "draftHard",
  "fantasy",
  "eraCup",
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

/**
 * Reconcile cloud and local stats without double-counting identical snapshots.
 * Local wins when it has newer progress on this device; otherwise merge only
 * when both buckets have independent multi-device history.
 */
export function reconcileUserStats(
  cloud: UserStatsData,
  local: UserStatsData
): UserStatsData {
  const c = migrateUserStats(cloud);
  const l = migrateUserStats(local);

  if (userStatsSyncEqual(c, l)) return c;

  const localSeasons = l.totalSeasonsSimulated;
  const cloudSeasons = c.totalSeasonsSimulated;
  const localGames = l.seasonWins + l.seasonLosses;
  const cloudGames = c.seasonWins + c.seasonLosses;

  if (localSeasons === 0 && localGames === 0 && l.totalRuns === 0) return c;

  if (
    localSeasons > cloudSeasons ||
    (localSeasons === cloudSeasons &&
      (l.totalRuns > c.totalRuns || localGames > cloudGames))
  ) {
    return l;
  }

  if (cloudSeasons > localSeasons || cloudGames > localGames) {
    if (localSeasons === 0 && l.totalRuns === 0 && localGames === 0) return c;
    return mergeUserStatsData(c, l);
  }

  return c;
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

  merged.eraChallengeCupRuns = merged.eraChallengeCupRuns ?? 0;

  merged.eraChallengeCupWins = merged.eraChallengeCupWins ?? merged.eraMatchWins ?? 0;

  merged.eraChallengeCupLosses =
    merged.eraChallengeCupLosses ?? merged.eraMatchLosses ?? 0;

  merged.eraChallengeCupLosses = merged.eraChallengeCupLosses ?? 0;

  merged.eraCupsWon = merged.eraCupsWon ?? 0;

  merged.eraMatchWins = merged.eraMatchWins ?? 0;

  merged.eraMatchLosses = merged.eraMatchLosses ?? 0;

  merged.bestEraTeamUsed = merged.bestEraTeamUsed ?? null;

  return merged;

}



function emptyStoredStats(): StoredStats {
  return {
    normal: { ...EMPTY_STATS },
    hard: { ...EMPTY_STATS },
    draftNormal: { ...EMPTY_STATS },
    draftHard: { ...EMPTY_STATS },
    fantasy: { ...EMPTY_STATS },
    eraCup: { ...EMPTY_STATS },
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
    eraCup: migrateUserStats(raw.eraCup ?? {}),
    eraNormal: migrateUserStats(raw.eraNormal ?? {}),
  };
}

function ensureStatsSchemaVersion(): void {
  if (typeof window === "undefined") return;
  const version = Number.parseInt(
    localStorage.getItem(STORAGE_KEYS.statsSchemaVersion) ?? "1",
    10
  );
  if (version >= STATS_SCHEMA_VERSION) return;
  // Legacy `normal` bucket remains Current Mode; eraNormal starts empty.
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

