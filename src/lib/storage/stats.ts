import { findBestPosition, buildSquadFromIds } from "../game/engine";

import { getPeriodKey } from "../leaderboard";

import {

  applySeasonLifetimeUpdate,

  type SeasonLifetimeInput,

} from "../lifetime-stats";

import { computeClubStats, mergeClubStats } from "../stats-helpers";

import type { GameDifficulty, UserStatsData } from "../types";

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

};



interface StoredStats {

  normal: UserStatsData;

  hard: UserStatsData;

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



  return merged;

}



function loadStoredStats(): StoredStats {

  if (typeof window === "undefined") {

    return { normal: { ...EMPTY_STATS }, hard: { ...EMPTY_STATS } };

  }

  try {

    const raw = localStorage.getItem(STORAGE_KEYS.stats);

    if (!raw) return { normal: { ...EMPTY_STATS }, hard: { ...EMPTY_STATS } };

    const parsed = JSON.parse(raw) as Partial<StoredStats> & Partial<UserStatsData>;



    if (parsed.normal || parsed.hard) {

      return {

        normal: migrateUserStats(parsed.normal ?? {}),

        hard: migrateUserStats(parsed.hard ?? {}),

      };

    }



    return {

      normal: migrateUserStats(parsed),

      hard: { ...EMPTY_STATS },

    };

  } catch {

    return { normal: { ...EMPTY_STATS }, hard: { ...EMPTY_STATS } };

  }

}



function saveStoredStats(data: StoredStats): void {

  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(data));

  void import("./stats-cloud").then(({ saveCloudStats }) => saveCloudStats(data));

}



export function getStats(difficulty: GameDifficulty = "NORMAL"): UserStatsData {

  const stored = loadStoredStats();

  return difficulty === "HARD" ? stored.hard : stored.normal;

}



export function getAllStats(): StoredStats {

  return loadStoredStats();

}



export function updateRerollStats(

  rerollsUsed: number,

  difficulty: GameDifficulty = "NORMAL"

): UserStatsData {

  if (difficulty === "HARD") {

    return getStats(difficulty);

  }



  const stored = loadStoredStats();

  const existing = stored.normal;

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



  stored.normal = updated;

  saveStoredStats(stored);

  return updated;

}



export function updateStats(

  signedIds: string[],

  totalValue: number,

  difficulty: GameDifficulty = "NORMAL",

  achievedAt = new Date()

): UserStatsData {

  const stored = loadStoredStats();

  const existing = difficulty === "HARD" ? stored.hard : stored.normal;

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



  if (difficulty === "HARD") {

    stored.hard = updated;

  } else {

    stored.normal = updated;

  }

  saveStoredStats(stored);

  return updated;

}



export function updateSeasonLifetimeStats(

  input: SeasonLifetimeInput,

  difficulty: GameDifficulty = "NORMAL"

): UserStatsData {

  const stored = loadStoredStats();

  const existing = difficulty === "HARD" ? stored.hard : stored.normal;

  const updated = applySeasonLifetimeUpdate(existing, input);



  if (difficulty === "HARD") {

    stored.hard = updated;

  } else {

    stored.normal = updated;

  }

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

