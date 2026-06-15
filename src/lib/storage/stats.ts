import { findBestPosition, buildSquadFromIds } from "../game/engine";

import { getPeriodKey } from "../leaderboard";

import {

  applySeasonLifetimeUpdate,

  type SeasonLifetimeInput,

} from "../lifetime-stats";

import { computeClubStats, mergeClubStats } from "../stats-helpers";

import type { GameDifficulty, UserStatsData } from "../types";

import { isLoggedIn } from "../auth-session";

import { STORAGE_KEYS } from "./keys";



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

};



interface StoredStats {

  normal: UserStatsData;

  hard: UserStatsData;

  draftNormal: UserStatsData;

  draftHard: UserStatsData;

  fantasy: UserStatsData;

  eraCup: UserStatsData;

}



export type { StoredStats };



function pickMoreActiveBucket(

  cloudBucket: UserStatsData,

  localBucket: UserStatsData,

  activityKey: keyof UserStatsData

): UserStatsData {

  const cloudVal = (cloudBucket[activityKey] as number) ?? 0;

  const localVal = (localBucket[activityKey] as number) ?? 0;

  return localVal > cloudVal ? localBucket : cloudBucket;

}



/** Merge cloud stats with local saves so era/draft/fantasy buckets are not wiped on login. */

export function mergeCloudStatsWithLocal(

  cloud: StoredStats,

  local: StoredStats

): StoredStats {

  return {

    normal: cloud.normal,

    hard: cloud.hard,

    draftNormal: pickMoreActiveBucket(

      cloud.draftNormal,

      local.draftNormal,

      "totalSeasonsSimulated"

    ),

    draftHard: pickMoreActiveBucket(

      cloud.draftHard,

      local.draftHard,

      "totalSeasonsSimulated"

    ),

    fantasy: pickMoreActiveBucket(

      cloud.fantasy,

      local.fantasy,

      "totalSeasonsSimulated"

    ),

    eraCup: pickMoreActiveBucket(

      cloud.eraCup,

      local.eraCup,

      "eraChallengeCupRuns"

    ),

  };

}



export type StatsBucket = keyof StoredStats;



export function resolveStatsBucket(

  mode: import("../types").GameMode,

  difficulty: GameDifficulty

): StatsBucket {

  if (mode === "DRAFT") {

    return difficulty === "HARD" ? "draftHard" : "draftNormal";

  }

  if (mode === "FANTASY") {

    return "fantasy";

  }

  if (mode === "ERA_CHALLENGE_CUP") {

    return "eraCup";

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



function loadStoredStats(): StoredStats {

  if (typeof window === "undefined") {

    return {

      normal: { ...EMPTY_STATS },

      hard: { ...EMPTY_STATS },

      draftNormal: { ...EMPTY_STATS },

      draftHard: { ...EMPTY_STATS },

      fantasy: { ...EMPTY_STATS },

      eraCup: { ...EMPTY_STATS },

    };

  }

  try {

    const raw = localStorage.getItem(STORAGE_KEYS.stats);

    if (!raw) {

      return {

        normal: { ...EMPTY_STATS },

        hard: { ...EMPTY_STATS },

      draftNormal: { ...EMPTY_STATS },

      draftHard: { ...EMPTY_STATS },

      fantasy: { ...EMPTY_STATS },

      eraCup: { ...EMPTY_STATS },

    };

    }

    const parsed = JSON.parse(raw) as Partial<StoredStats> & Partial<UserStatsData>;



    if (parsed.normal || parsed.hard) {

      return {

        normal: migrateUserStats(parsed.normal ?? {}),

        hard: migrateUserStats(parsed.hard ?? {}),

        draftNormal: migrateUserStats(parsed.draftNormal ?? {}),

        draftHard: migrateUserStats(parsed.draftHard ?? {}),

        fantasy: migrateUserStats(parsed.fantasy ?? {}),

        eraCup: migrateUserStats(parsed.eraCup ?? {}),

      };

    }



    return {

      normal: migrateUserStats(parsed),

      hard: { ...EMPTY_STATS },

      draftNormal: { ...EMPTY_STATS },

      draftHard: { ...EMPTY_STATS },

      fantasy: { ...EMPTY_STATS },

      eraCup: { ...EMPTY_STATS },

    };

  } catch {

    return {

      normal: { ...EMPTY_STATS },

      hard: { ...EMPTY_STATS },

      draftNormal: { ...EMPTY_STATS },

      draftHard: { ...EMPTY_STATS },

      fantasy: { ...EMPTY_STATS },

      eraCup: { ...EMPTY_STATS },

    };

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

    newTotalRuns > 0

      ? Math.round((newTotalRerolls / newTotalRuns) * 10) / 10

      : 0;



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

