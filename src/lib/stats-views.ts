import {
  formatRecord,
  isBetterRecord,
  isWorseRecord,
  getMostSelectedPlayer,
  getMostSuccessfulPlayer,
  getWorstPerformingPlayer,
} from "./lifetime-stats";
import { getCupWinPercentage } from "./cup-ranking";
import type { CupPersonalBests, UserStatsData } from "./types";

export type StatsTabId =
  | "overall"
  | "super-league"
  | "hard-mode"
  | "challenge-cup";

export const STATS_TABS: { id: StatsTabId; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "super-league", label: "Super League" },
  { id: "hard-mode", label: "Hard Mode" },
  { id: "challenge-cup", label: "Challenge Cup" },
];

function mergeDraftCounts(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const merged = { ...a };
  for (const [id, count] of Object.entries(b)) {
    merged[id] = (merged[id] ?? 0) + count;
  }
  return merged;
}

function pickBestSeasonRecord(
  a: UserStatsData,
  b: UserStatsData
): { wins: number; losses: number } | null {
  const aHas = a.totalSeasonsSimulated > 0;
  const bHas = b.totalSeasonsSimulated > 0;
  if (!aHas && !bHas) return null;
  if (!aHas) return { wins: b.bestRecordWins, losses: b.bestRecordLosses };
  if (!bHas) return { wins: a.bestRecordWins, losses: a.bestRecordLosses };
  return isBetterRecord(
    a.bestRecordWins,
    a.bestRecordLosses,
    b.bestRecordWins,
    b.bestRecordLosses
  )
    ? { wins: a.bestRecordWins, losses: a.bestRecordLosses }
    : { wins: b.bestRecordWins, losses: b.bestRecordLosses };
}

function pickWorstSeasonRecord(
  a: UserStatsData,
  b: UserStatsData
): { wins: number; losses: number } | null {
  const aHas = a.totalSeasonsSimulated > 0;
  const bHas = b.totalSeasonsSimulated > 0;
  if (!aHas && !bHas) return null;
  if (!aHas) return { wins: b.worstRecordWins, losses: b.worstRecordLosses };
  if (!bHas) return { wins: a.worstRecordWins, losses: a.worstRecordLosses };
  return isWorseRecord(
    a.worstRecordWins,
    a.worstRecordLosses,
    b.worstRecordWins,
    b.worstRecordLosses
  )
    ? { wins: a.worstRecordWins, losses: a.worstRecordLosses }
    : { wins: b.worstRecordWins, losses: b.worstRecordLosses };
}

function pickBestRanking(
  a: number | null,
  b: number | null
): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function pickBestCupFinish(
  a: string | null,
  b: string | null
): string | null {
  const rank = (f: string | null): number => {
    switch (f) {
      case "Winners":
        return 5;
      case "Runners-Up":
        return 4;
      case "Semi Final":
        return 3;
      case "Quarter Final":
        return 2;
      case "Round of 16":
        return 1;
      default:
        return 0;
    }
  };
  const aRank = rank(a);
  const bRank = rank(b);
  if (aRank === 0) return b;
  if (bRank === 0) return a;
  return aRank >= bRank ? a : b;
}

export function getOverallView(normal: UserStatsData, hard: UserStatsData) {
  const bestRecord = pickBestSeasonRecord(normal, hard);
  const worstRecord = pickWorstSeasonRecord(normal, hard);
  const mergedDrafts = mergeDraftCounts(normal.draftCounts, hard.draftCounts);
  const mergedSeasonWins = mergeDraftCounts(
    normal.playerSeasonWins,
    hard.playerSeasonWins
  );
  const mergedSeasonLosses = mergeDraftCounts(
    normal.playerSeasonLosses,
    hard.playerSeasonLosses
  );

  const lowestValues = [normal.lowestSquadValue, hard.lowestSquadValue].filter(
    (v): v is number => v !== null
  );

  return {
    totalRuns: normal.totalRuns + hard.totalRuns,
    totalWins:
      normal.seasonWins +
      normal.challengeCupWins +
      hard.seasonWins +
      hard.challengeCupWins,
    totalLosses:
      normal.seasonLosses +
      normal.challengeCupLosses +
      hard.seasonLosses +
      hard.challengeCupLosses,
    totalSeasons: normal.totalSeasonsSimulated + hard.totalSeasonsSimulated,
    bestRecord,
    worstRecord,
    longestUnbeatenRun: Math.max(
      normal.longestUnbeatenRun,
      hard.longestUnbeatenRun
    ),
    longestLosingStreak: Math.max(
      normal.longestLosingStreak,
      hard.longestLosingStreak
    ),
    leagueTitles: normal.leagueTitlesWon + hard.leagueTitlesWon,
    challengeCups: normal.challengeCupsWon + hard.challengeCupsWon,
    perfectSeasons:
      normal.totalPerfectSeasons + hard.totalPerfectSeasons,
    winlessSeasons:
      normal.totalWinlessSeasons + hard.totalWinlessSeasons,
    highestSquadValue: Math.max(
      normal.highestSquadValue,
      hard.highestSquadValue
    ),
    lowestSquadValue:
      lowestValues.length > 0 ? Math.min(...lowestValues) : null,
    bestNationalRanking: pickBestRanking(
      normal.bestNationalRanking,
      hard.bestNationalRanking
    ),
    mostSelected: getMostSelectedPlayer(mergedDrafts),
    mostSuccessful: getMostSuccessfulPlayer(mergedSeasonWins),
    worstPerforming: getWorstPerformingPlayer(mergedSeasonLosses),
    mostValuablePlayer: pickBestMvp(normal, hard),
    totalRerollsUsed: normal.totalRerollsUsed,
    mostRerollsInRun: normal.mostRerollsInRun,
    averageRerollsPerRun: normal.averageRerollsPerRun,
  };
}

function pickBestMvp(normal: UserStatsData, hard: UserStatsData) {
  if (
    hard.mostValuablePlayerEverPulledVal >
    normal.mostValuablePlayerEverPulledVal
  ) {
    return {
      name: hard.mostValuablePlayerEverPulled,
      value: hard.mostValuablePlayerEverPulledVal,
    };
  }
  return {
    name: normal.mostValuablePlayerEverPulled,
    value: normal.mostValuablePlayerEverPulledVal,
  };
}

export function getSuperLeagueView(stats: UserStatsData) {
  return {
    runs: stats.totalSeasonsSimulated,
    wins: stats.seasonWins,
    losses: stats.seasonLosses,
    hasSeasons: stats.totalSeasonsSimulated > 0,
    bestRecord: {
      wins: stats.bestRecordWins,
      losses: stats.bestRecordLosses,
    },
    worstRecord: {
      wins: stats.worstRecordWins,
      losses: stats.worstRecordLosses,
    },
    leagueTitles: stats.leagueTitlesWon,
    perfectSeasons: stats.totalPerfectSeasons,
    winlessSeasons: stats.totalWinlessSeasons,
    bestRanking: stats.bestNationalRanking,
  };
}

export function getHardModeView(stats: UserStatsData) {
  return {
    runs: stats.totalRuns,
    wins: stats.seasonWins + stats.challengeCupWins,
    losses: stats.seasonLosses + stats.challengeCupLosses,
    hasSeasons: stats.totalSeasonsSimulated > 0,
    bestRecord: {
      wins: stats.bestRecordWins,
      losses: stats.bestRecordLosses,
    },
    worstRecord: {
      wins: stats.worstRecordWins,
      losses: stats.worstRecordLosses,
    },
    leagueTitles: stats.leagueTitlesWon,
    challengeCups: stats.challengeCupsWon,
    perfectSeasons: stats.totalPerfectSeasons,
    winlessSeasons: stats.totalWinlessSeasons,
    bestRanking: pickBestRanking(
      stats.bestNationalRanking,
      stats.bestCupNationalRanking
    ),
  };
}

export function getChallengeCupView(normal: UserStatsData, hard: UserStatsData) {
  const ratings = [
    normal.highestCupSquadRating,
    hard.highestCupSquadRating,
  ].filter((r): r is number => r !== null);
  const lowRatings = [
    normal.lowestCupSquadRating,
    hard.lowestCupSquadRating,
  ].filter((r): r is number => r !== null);

  return {
    runs: normal.challengeCupRuns + hard.challengeCupRuns,
    wins: normal.challengeCupWins + hard.challengeCupWins,
    losses: normal.challengeCupLosses + hard.challengeCupLosses,
    cupsWon: normal.challengeCupsWon + hard.challengeCupsWon,
    finals: normal.challengeCupFinals + hard.challengeCupFinals,
    semiFinals: normal.challengeCupSemiFinals + hard.challengeCupSemiFinals,
    quarterFinals:
      normal.challengeCupQuarterFinals + hard.challengeCupQuarterFinals,
    bestFinish: pickBestCupFinish(normal.bestCupFinish, hard.bestCupFinish),
    bestRanking: pickBestRanking(
      normal.bestCupNationalRanking,
      hard.bestCupNationalRanking
    ),
    highestRatedSquad: ratings.length > 0 ? Math.max(...ratings) : null,
    lowestRatedSquad: lowRatings.length > 0 ? Math.min(...lowRatings) : null,
  };
}

export function formatRecordOrDash(
  record: { wins: number; losses: number } | null
): string {
  return record ? formatRecord(record.wins, record.losses) : "—";
}

export function formatRankingOrDash(rank: number | null): string {
  return rank !== null ? `#${rank}` : "—";
}

export function formatRatingOrDash(rating: number | null): string {
  return rating !== null ? String(rating) : "—";
}

export function formatWinPercentageOrDash(
  value: number,
  hasGames = true
): string {
  if (!hasGames) return "—";
  return `${value}%`;
}

export function getChallengeCupPersonalBests(
  normal: UserStatsData,
  hard: UserStatsData
): CupPersonalBests {
  const wins = normal.challengeCupWins + hard.challengeCupWins;
  const losses = normal.challengeCupLosses + hard.challengeCupLosses;

  return {
    mostCupMatchWins: Math.max(
      normal.bestCupMatchWinsInTournament,
      hard.bestCupMatchWinsInTournament
    ),
    bestTournamentFinish: pickBestCupFinish(
      normal.bestCupFinish,
      hard.bestCupFinish
    ),
    longestCupWinningStreak: Math.max(
      normal.longestCupMatchWinStreak,
      hard.longestCupMatchWinStreak
    ),
    mostCupsWon: normal.challengeCupsWon + hard.challengeCupsWon,
    bestCupWinPercentage: getCupWinPercentage(wins, losses),
  };
}
