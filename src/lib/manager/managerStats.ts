import { STORAGE_KEYS } from "../storage/keys";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { syncManagerLeaderboard } from "../storage/manager-leaderboard";
import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import { getUserLeagueTablePosition } from "./managerFixtures";
import { pickManagerWorstSeasonRecord } from "./manager-stats-views";
import type { ManagerCareer, ManagerLifetimeStats } from "./types";

const STATS_KEY = STORAGE_KEYS.managerStats;

export const EMPTY_MANAGER_STATS: ManagerLifetimeStats = {
  careersStarted: 0,
  seasonsCompleted: 0,
  wins: 0,
  losses: 0,
  trophies: 0,
  leagueTitles: 0,
  superLeagueTitles: 0,
  challengeCups: 0,
  cupFinals: 0,
  topSixFinishes: 0,
  perfectSeasons: 0,
  winlessSeasons: 0,
  bestFinish: null,
  worstRecordWins: null,
  worstRecordLosses: null,
  biggestWin: 0,
  biggestDefeat: 0,
  totalEarnings: 0,
  favouriteClub: null,
  clubSeasons: {},
};

export function loadManagerStats(): ManagerLifetimeStats {
  if (typeof window === "undefined") return { ...EMPTY_MANAGER_STATS };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_MANAGER_STATS };
    return { ...EMPTY_MANAGER_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_MANAGER_STATS };
  }
}

export function saveManagerStats(stats: ManagerLifetimeStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordCareerStarted(club: string): void {
  const stats = loadManagerStats();
  stats.careersStarted++;
  stats.clubSeasons[club] = (stats.clubSeasons[club] ?? 0) + 1;
  const topClub = Object.entries(stats.clubSeasons).sort(
    (a, b) => b[1] - a[1]
  )[0];
  stats.favouriteClub = topClub?.[0] ?? club;
  saveManagerStats(stats);
  syncManagerLeaderboard(stats);
}

export function recordMatchResult(
  won: boolean,
  margin: number,
  earnings: number
): void {
  const stats = loadManagerStats();
  if (won) {
    stats.wins++;
    if (margin > stats.biggestWin) stats.biggestWin = margin;
  } else {
    stats.losses++;
    if (margin > stats.biggestDefeat) stats.biggestDefeat = margin;
  }
  stats.totalEarnings += earnings;
  saveManagerStats(stats);
  syncManagerLeaderboard(stats);
}

export function recordLeaguePhaseAchievements(career: ManagerCareer): void {
  if (!isLeagueAndCupPhaseComplete(career)) return;
  if (career.leaguePhaseStatsRecordedForYear === career.seasonYear) return;

  const stats = loadManagerStats();
  const position = getUserLeagueTablePosition(career);
  const seasonWins = career.wins;
  const seasonLosses = career.losses;

  if (position === 1) {
    stats.leagueTitles++;
    stats.trophies++;
  }
  if (position <= 6) {
    stats.topSixFinishes++;
  }
  if (seasonWins === 27 && seasonLosses === 0) {
    stats.perfectSeasons++;
  }
  if (seasonWins === 0 && seasonLosses === 27) {
    stats.winlessSeasons++;
  }

  saveManagerStats(stats);
  syncManagerLeaderboard(stats);
}

export function recordSeasonComplete(career: ManagerCareer): void {
  recordLeaguePhaseAchievements(career);

  const stats = loadManagerStats();
  stats.seasonsCompleted++;

  const position = getUserLeagueTablePosition(career);
  const seasonWins = career.wins;
  const seasonLosses = career.losses;

  if (stats.bestFinish === null || position < stats.bestFinish) {
    stats.bestFinish = position;
  }

  const worst = pickManagerWorstSeasonRecord(stats, seasonWins, seasonLosses);
  stats.worstRecordWins = worst.wins;
  stats.worstRecordLosses = worst.losses;

  const playoffFinish = career.playoffs?.finish ?? null;
  if (playoffFinish === "Super League Champions") {
    stats.superLeagueTitles++;
    stats.trophies++;
  }

  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  if (cupOutcome.isWinner) {
    stats.challengeCups++;
    stats.trophies++;
  }
  if (cupOutcome.isWinner || cupOutcome.finish === "Runners-Up") {
    stats.cupFinals++;
  }

  saveManagerStats(stats);
  syncManagerLeaderboard(stats);
}

/** Credit global lifetime stats for league table finish once per season. */
export function recordLeaguePhaseAchievementsIfNeeded(
  career: ManagerCareer
): ManagerCareer {
  if (!isLeagueAndCupPhaseComplete(career)) return career;
  if (career.leaguePhaseStatsRecordedForYear === career.seasonYear) {
    return career;
  }
  recordLeaguePhaseAchievements(career);
  return {
    ...career,
    leaguePhaseStatsRecordedForYear: career.seasonYear,
  };
}

export { STATS_KEY };
