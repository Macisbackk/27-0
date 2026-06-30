import type { ManagerCareer, ManagerLifetimeStats } from "./types";

const STATS_KEY = "27-0-manager-stats";

export const EMPTY_MANAGER_STATS: ManagerLifetimeStats = {
  careersStarted: 0,
  seasonsCompleted: 0,
  wins: 0,
  losses: 0,
  trophies: 0,
  leagueTitles: 0,
  challengeCups: 0,
  bestFinish: null,
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
}

export function recordSeasonComplete(career: ManagerCareer): void {
  const stats = loadManagerStats();
  stats.seasonsCompleted++;
  const position =
    career.leagueTable.find((r) => r.isUserTeam)?.position ?? 14;
  if (stats.bestFinish === null || position < stats.bestFinish) {
    stats.bestFinish = position;
  }
  if (position === 1) {
    stats.leagueTitles++;
    stats.trophies++;
  }
  saveManagerStats(stats);
}

export { STATS_KEY };
