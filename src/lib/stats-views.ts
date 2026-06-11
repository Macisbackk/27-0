import {
  formatRecord,
  isWorseRecord,
  getMostSelectedPlayer,
  getMostSuccessfulPlayer,
  getWorstPerformingPlayer,
} from "./lifetime-stats";
import { EMPTY_STATS } from "./storage/stats";
import { getCupWinPercentage } from "./cup-ranking";
import type { CupPersonalBests, UserStatsData } from "./types";

export type StatsTabId =
  | "overall"
  | "super-league"
  | "hard-mode"
  | "draft-mode"
  | "challenge-cup"
  | "fantasy-mode";

export const STATS_TABS: { id: StatsTabId; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "super-league", label: "Normal Mode" },
  { id: "hard-mode", label: "Hard Mode" },
  { id: "draft-mode", label: "Draft Mode" },
  { id: "fantasy-mode", label: "Fantasy Mode" },
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

export function getOverallView(
  normal: UserStatsData,
  hard: UserStatsData,
  draftNormal?: UserStatsData,
  draftHard?: UserStatsData
) {
  const draftN = draftNormal ?? { ...EMPTY_STATS };
  const draftH = draftHard ?? { ...EMPTY_STATS };
  const totalRecord = {
    wins:
      normal.seasonWins +
      hard.seasonWins +
      draftN.seasonWins +
      draftH.seasonWins,
    losses:
      normal.seasonLosses +
      hard.seasonLosses +
      draftN.seasonLosses +
      draftH.seasonLosses,
  };
  const worstRecord = pickWorstSeasonRecord(normal, hard);
  const mergedDrafts = mergeDraftCounts(
    mergeDraftCounts(normal.draftCounts, hard.draftCounts),
    mergeDraftCounts(draftN.draftCounts, draftH.draftCounts)
  );
  const mergedSeasonWins = mergeDraftCounts(
    mergeDraftCounts(normal.playerSeasonWins, hard.playerSeasonWins),
    mergeDraftCounts(draftN.playerSeasonWins, draftH.playerSeasonWins)
  );
  const mergedSeasonLosses = mergeDraftCounts(
    mergeDraftCounts(normal.playerSeasonLosses, hard.playerSeasonLosses),
    mergeDraftCounts(draftN.playerSeasonLosses, draftH.playerSeasonLosses)
  );

  const lowestValues = [
    normal.lowestSquadValue,
    hard.lowestSquadValue,
    draftN.lowestSquadValue,
    draftH.lowestSquadValue,
  ].filter((v): v is number => v !== null);

  return {
    totalRuns:
      normal.totalRuns +
      hard.totalRuns +
      draftN.totalSeasonsSimulated +
      draftH.totalSeasonsSimulated,
    totalWins:
      normal.seasonWins +
      normal.challengeCupWins +
      hard.seasonWins +
      hard.challengeCupWins +
      draftN.seasonWins +
      draftH.seasonWins,
    totalLosses:
      normal.seasonLosses +
      normal.challengeCupLosses +
      hard.seasonLosses +
      hard.challengeCupLosses +
      draftN.seasonLosses +
      draftH.seasonLosses,
    totalSeasons:
      normal.totalSeasonsSimulated +
      hard.totalSeasonsSimulated +
      draftN.totalSeasonsSimulated +
      draftH.totalSeasonsSimulated,
    totalRecord,
    worstRecord,
    longestUnbeatenRun: Math.max(
      normal.longestUnbeatenRun,
      hard.longestUnbeatenRun
    ),
    longestLosingStreak: Math.max(
      normal.longestLosingStreak,
      hard.longestLosingStreak
    ),
    leagueTitles:
      normal.leagueTitlesWon +
      hard.leagueTitlesWon +
      draftN.leagueTitlesWon +
      draftH.leagueTitlesWon,
    challengeCups: normal.challengeCupsWon + hard.challengeCupsWon,
    perfectSeasons:
      normal.totalPerfectSeasons +
      hard.totalPerfectSeasons +
      draftN.totalPerfectSeasons +
      draftH.totalPerfectSeasons,
    winlessSeasons:
      normal.totalWinlessSeasons +
      hard.totalWinlessSeasons +
      draftN.totalWinlessSeasons +
      draftH.totalWinlessSeasons,
    highestSquadValue: Math.max(
      normal.highestSquadValue,
      hard.highestSquadValue,
      draftN.highestSquadValue,
      draftH.highestSquadValue
    ),
    lowestSquadValue:
      lowestValues.length > 0 ? Math.min(...lowestValues) : null,
    bestNationalRanking: pickBestRanking(
      pickBestRanking(normal.bestNationalRanking, hard.bestNationalRanking),
      pickBestRanking(draftN.bestNationalRanking, draftH.bestNationalRanking)
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
    winPercentage: formatWinPercentage(stats.seasonWins, stats.seasonLosses),
    hasSeasons: stats.totalSeasonsSimulated > 0,
    totalRecord: {
      wins: stats.seasonWins,
      losses: stats.seasonLosses,
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

/** Hard classic signing — season stats only (not draft or cup). */
export function getHardNormalModeView(stats: UserStatsData) {
  return getSuperLeagueView(stats);
}

/** @deprecated Use getHardNormalModeView */
export function getHardModeView(stats: UserStatsData) {
  return getHardNormalModeView(stats);
}

export function getDraftModeView(stats: UserStatsData) {
  return {
    runs: stats.totalSeasonsSimulated,
    wins: stats.seasonWins,
    losses: stats.seasonLosses,
    winPercentage: formatWinPercentage(stats.seasonWins, stats.seasonLosses),
    hasSeasons: stats.totalSeasonsSimulated > 0,
    totalRecord: {
      wins: stats.seasonWins,
      losses: stats.seasonLosses,
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

export function getHardDraftModeView(stats: UserStatsData) {
  return {
    runs: stats.totalSeasonsSimulated,
    wins: stats.seasonWins,
    losses: stats.seasonLosses,
    winPercentage: formatWinPercentage(stats.seasonWins, stats.seasonLosses),
    hasSeasons: stats.totalSeasonsSimulated > 0,
    totalRecord: {
      wins: stats.seasonWins,
      losses: stats.seasonLosses,
    },
    worstRecord: {
      wins: stats.worstRecordWins,
      losses: stats.worstRecordLosses,
    },
    leagueTitles: stats.leagueTitlesWon,
    perfectSeasons: stats.totalPerfectSeasons,
    winlessSeasons: stats.totalWinlessSeasons,
  };
}

export function getFantasyModeView(stats: UserStatsData) {
  return {
    runs: stats.totalSeasonsSimulated,
    wins: stats.seasonWins,
    losses: stats.seasonLosses,
    winPercentage: formatWinPercentage(stats.seasonWins, stats.seasonLosses),
    hasSeasons: stats.totalSeasonsSimulated > 0,
    totalRecord: {
      wins: stats.seasonWins,
      losses: stats.seasonLosses,
    },
    worstRecord: {
      wins: stats.worstRecordWins,
      losses: stats.worstRecordLosses,
    },
    leagueTitles: stats.leagueTitlesWon,
    perfectSeasons: stats.totalPerfectSeasons,
    winlessSeasons: stats.totalWinlessSeasons,
    bestSquadValue: stats.highestSquadValue,
    bestTeamRating: stats.bestTeamRating > 0 ? stats.bestTeamRating : null,
  };
}

export function getHardChallengeCupView(stats: UserStatsData) {
  const wins = stats.challengeCupWins;
  const losses = stats.challengeCupLosses;
  return {
    appearances: stats.challengeCupRuns,
    wins,
    losses,
    cupsWon: stats.challengeCupsWon,
    finals: stats.challengeCupFinals,
    winPercentage: formatWinPercentage(wins, losses),
    hasGames: wins + losses > 0,
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
    totalRecord: {
      wins: normal.challengeCupWins + hard.challengeCupWins,
      losses: normal.challengeCupLosses + hard.challengeCupLosses,
    },
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

export function formatWinPercentage(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
}

export function formatWinPercentageOrDash(
  value: number | null,
  hasGames = true
): string {
  if (!hasGames || value === null) return "—";
  return `${value}%`;
}

export function formatSeasonWinPercentageOrDash(
  wins: number,
  losses: number
): string {
  return formatWinPercentageOrDash(formatWinPercentage(wins, losses));
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
