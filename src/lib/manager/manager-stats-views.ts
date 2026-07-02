import { isWorseRecord } from "../lifetime-stats";
import type { ManagerLifetimeStats } from "./types";

export type ManagerStatsTabId = "overall" | "super-league" | "challenge-cup";

export const MANAGER_STATS_TABS: { id: ManagerStatsTabId; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "super-league", label: "Super League" },
  { id: "challenge-cup", label: "Challenge Cup" },
];

function formatFinish(position: number | null): string {
  if (position === null) return "—";
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

export function getManagerOverallView(stats: ManagerLifetimeStats) {
  const worstRecord =
    stats.worstRecordWins !== null && stats.worstRecordLosses !== null
      ? { wins: stats.worstRecordWins, losses: stats.worstRecordLosses }
      : null;

  return {
    totalSeasons: stats.seasonsCompleted,
    careersStarted: stats.careersStarted,
    totalWins: stats.wins,
    totalLosses: stats.losses,
    totalRecord: { wins: stats.wins, losses: stats.losses },
    worstRecord,
    leagueTitles: stats.leagueTitles,
    superLeagueTitles: stats.superLeagueTitles,
    challengeCups: stats.challengeCups,
    perfectSeasons: stats.perfectSeasons,
    winlessSeasons: stats.winlessSeasons,
    trophies: stats.trophies,
    favouriteClub: stats.favouriteClub,
    totalEarnings: stats.totalEarnings,
    biggestWin: stats.biggestWin,
    biggestDefeat: stats.biggestDefeat,
    bestFinish: formatFinish(stats.bestFinish),
  };
}

export function getManagerSuperLeagueView(stats: ManagerLifetimeStats) {
  const hasSeasons = stats.seasonsCompleted > 0;
  const worstRecord =
    stats.worstRecordWins !== null && stats.worstRecordLosses !== null
      ? { wins: stats.worstRecordWins, losses: stats.worstRecordLosses }
      : null;

  return {
    seasons: stats.seasonsCompleted,
    wins: stats.wins,
    losses: stats.losses,
    hasSeasons,
    totalRecord: { wins: stats.wins, losses: stats.losses },
    worstRecord,
    leagueTitles: stats.leagueTitles,
    superLeagueTitles: stats.superLeagueTitles,
    topSixFinishes: stats.topSixFinishes,
    bestFinish: formatFinish(stats.bestFinish),
    perfectSeasons: stats.perfectSeasons,
    winlessSeasons: stats.winlessSeasons,
    favouriteClub: stats.favouriteClub,
  };
}

export function getManagerChallengeCupView(stats: ManagerLifetimeStats) {
  return {
    seasons: stats.seasonsCompleted,
    cupsWon: stats.challengeCups,
    finals: stats.cupFinals,
    trophies: stats.trophies,
  };
}

export function pickManagerWorstSeasonRecord(
  stats: ManagerLifetimeStats,
  seasonWins: number,
  seasonLosses: number
): { wins: number; losses: number } {
  if (stats.worstRecordWins === null || stats.worstRecordLosses === null) {
    return { wins: seasonWins, losses: seasonLosses };
  }
  if (
    isWorseRecord(
      seasonWins,
      seasonLosses,
      stats.worstRecordWins,
      stats.worstRecordLosses
    )
  ) {
    return { wins: seasonWins, losses: seasonLosses };
  }
  return { wins: stats.worstRecordWins, losses: stats.worstRecordLosses };
}
