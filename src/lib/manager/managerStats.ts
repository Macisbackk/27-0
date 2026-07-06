import { STORAGE_KEYS } from "../storage/keys";
import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { syncManagerLeaderboard } from "../storage/manager-leaderboard";
import { isLoggedIn } from "../auth-session";
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

function managerStatsSignature(stats: ManagerLifetimeStats): string {
  return [
    stats.seasonsCompleted,
    stats.wins,
    stats.losses,
    stats.leagueTitles,
    stats.totalEarnings,
  ].join(":");
}

function pickRicherManagerStats(
  a: ManagerLifetimeStats,
  b: ManagerLifetimeStats
): ManagerLifetimeStats {
  if (a.seasonsCompleted !== b.seasonsCompleted) {
    return a.seasonsCompleted > b.seasonsCompleted ? a : b;
  }
  const aGames = a.wins + a.losses;
  const bGames = b.wins + b.losses;
  if (aGames !== bGames) return aGames > bGames ? a : b;
  if (a.totalEarnings !== b.totalEarnings) {
    return a.totalEarnings > b.totalEarnings ? a : b;
  }
  return a;
}

export function reconcileManagerStats(
  cloud: ManagerLifetimeStats,
  local: ManagerLifetimeStats
): ManagerLifetimeStats {
  const c = sanitizeManagerStats(cloud);
  const l = sanitizeManagerStats(local);

  if (managerStatsSignature(c) === managerStatsSignature(l)) return c;

  const localEmpty =
    l.seasonsCompleted === 0 && l.wins === 0 && l.losses === 0;
  const cloudEmpty =
    c.seasonsCompleted === 0 && c.wins === 0 && c.losses === 0;

  if (localEmpty) return c;
  if (cloudEmpty) return l;

  return pickRicherManagerStats(c, l);
}

export function sanitizeManagerStats(
  raw: Partial<ManagerLifetimeStats>
): ManagerLifetimeStats {
  const merged = { ...EMPTY_MANAGER_STATS, ...raw };
  return {
    ...merged,
    careersStarted: Math.round(merged.careersStarted),
    seasonsCompleted: Math.round(merged.seasonsCompleted),
    wins: Math.round(merged.wins),
    losses: Math.round(merged.losses),
    trophies: Math.round(merged.trophies),
    leagueTitles: Math.round(merged.leagueTitles),
    superLeagueTitles: Math.round(merged.superLeagueTitles),
    challengeCups: Math.round(merged.challengeCups),
    cupFinals: Math.round(merged.cupFinals),
    topSixFinishes: Math.round(merged.topSixFinishes),
    perfectSeasons: Math.round(merged.perfectSeasons),
    winlessSeasons: Math.round(merged.winlessSeasons),
    biggestWin: Math.round(merged.biggestWin),
    biggestDefeat: Math.round(merged.biggestDefeat),
    totalEarnings: Math.round(merged.totalEarnings),
    bestFinish:
      merged.bestFinish !== null ? Math.round(merged.bestFinish) : null,
    worstRecordWins:
      merged.worstRecordWins !== null
        ? Math.round(merged.worstRecordWins)
        : null,
    worstRecordLosses:
      merged.worstRecordLosses !== null
        ? Math.round(merged.worstRecordLosses)
        : null,
  };
}

export function loadManagerStats(): ManagerLifetimeStats {
  if (typeof window === "undefined") return { ...EMPTY_MANAGER_STATS };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_MANAGER_STATS };
    return sanitizeManagerStats(JSON.parse(raw) as Partial<ManagerLifetimeStats>);
  } catch {
    return { ...EMPTY_MANAGER_STATS };
  }
}

export function saveManagerStats(stats: ManagerLifetimeStats): void {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeManagerStats(stats);
  localStorage.setItem(STATS_KEY, JSON.stringify(sanitized));
  if (isLoggedIn()) {
    void import("../storage/manager-stats-cloud").then(({ saveCloudManagerStats }) =>
      saveCloudManagerStats(sanitized)
    );
  }
}

export async function refreshManagerStatsFromCloud(): Promise<boolean> {
  if (typeof window === "undefined" || !isLoggedIn()) return false;

  const { loadCloudManagerStats, saveCloudManagerStats } = await import(
    "../storage/manager-stats-cloud"
  );

  const cloud = await loadCloudManagerStats();
  const local = loadManagerStats();

  if (!cloud) {
    if (
      local.seasonsCompleted > 0 ||
      local.wins > 0 ||
      local.losses > 0 ||
      local.careersStarted > 0
    ) {
      await saveCloudManagerStats(local);
    }
    return true;
  }

  const reconciled = reconcileManagerStats(cloud, local);
  localStorage.setItem(STATS_KEY, JSON.stringify(reconciled));

  if (managerStatsSignature(reconciled) !== managerStatsSignature(cloud)) {
    await saveCloudManagerStats(reconciled);
  }

  syncManagerLeaderboard(reconciled);
  window.dispatchEvent(new Event("stats-merged"));
  return true;
}

export async function flushManagerStatsToCloud(): Promise<void> {
  if (typeof window === "undefined" || !isLoggedIn()) return;
  const { saveCloudManagerStats } = await import("../storage/manager-stats-cloud");
  await saveCloudManagerStats(loadManagerStats());
}

export function resetManagerStats(): void {
  if (typeof window === "undefined") return;
  const empty = { ...EMPTY_MANAGER_STATS };
  saveManagerStats(empty);
  syncManagerLeaderboard(empty);
  void import("../storage/manager-stats-cloud").then(({ saveCloudManagerStats }) =>
    saveCloudManagerStats(empty)
  );
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
