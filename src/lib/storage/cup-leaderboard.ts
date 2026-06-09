import { applyMatchResultsToStreak, getCupFinishRank } from "../cup-ranking";
import type { UserStatsData } from "../types";
import { STORAGE_KEYS } from "./keys";
import { getUsername } from "./user";

export interface CupLeaderboardProfile {
  username: string;
  cupsWon: number;
  cupMatchWins: number;
  cupMatchLosses: number;
  cupFinals: number;
  cupSemiFinals: number;
  cupQuarterFinals: number;
  longestCupMatchWinStreak: number;
  currentCupMatchWinStreak: number;
  longestTournamentWinsInRow: number;
  /** Tracks consecutive tournament wins for streak calculation */
  currentTournamentWinsInRow: number;
  lastUpdated: string;
}

export interface CupRunInput {
  wins: number;
  losses: number;
  cupWon: boolean;
  cupFinish?: string;
  matchResults: ("W" | "L")[];
}

function emptyProfile(username: string): CupLeaderboardProfile {
  return {
    username,
    cupsWon: 0,
    cupMatchWins: 0,
    cupMatchLosses: 0,
    cupFinals: 0,
    cupSemiFinals: 0,
    cupQuarterFinals: 0,
    longestCupMatchWinStreak: 0,
    currentCupMatchWinStreak: 0,
    longestTournamentWinsInRow: 0,
    currentTournamentWinsInRow: 0,
    lastUpdated: new Date(0).toISOString(),
  };
}

function loadProfiles(): Record<string, CupLeaderboardProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cupLeaderboard);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CupLeaderboardProfile>;
  } catch {
    return {};
  }
}

function saveProfiles(profiles: Record<string, CupLeaderboardProfile>): void {
  localStorage.setItem(
    STORAGE_KEYS.cupLeaderboard,
    JSON.stringify(profiles)
  );
}

export function getAllCupLeaderboardProfiles(): CupLeaderboardProfile[] {
  return Object.values(loadProfiles()).sort((a, b) =>
    a.username.localeCompare(b.username)
  );
}

export function getCupLeaderboardProfile(
  username?: string
): CupLeaderboardProfile {
  const name = username ?? getUsername();
  const profiles = loadProfiles();
  return profiles[name] ?? emptyProfile(name);
}

export function updateCupLeaderboardProfile(
  input: CupRunInput,
  username?: string
): CupLeaderboardProfile {
  const name = username ?? getUsername();
  const profiles = loadProfiles();
  const existing = profiles[name] ?? emptyProfile(name);

  const finishRank = getCupFinishRank(input.cupFinish);
  const streak = applyMatchResultsToStreak(
    existing.currentCupMatchWinStreak,
    existing.longestCupMatchWinStreak,
    input.matchResults
  );
  const newTournamentRow = input.cupWon
    ? existing.currentTournamentWinsInRow + 1
    : 0;

  const updated: CupLeaderboardProfile = {
    ...existing,
    username: name,
    cupMatchWins: existing.cupMatchWins + input.wins,
    cupMatchLosses: existing.cupMatchLosses + input.losses,
    cupsWon: existing.cupsWon + (input.cupWon ? 1 : 0),
    cupFinals:
      existing.cupFinals +
      (input.cupFinish === "Winners" || input.cupFinish === "Runners-Up"
        ? 1
        : 0),
    cupSemiFinals: existing.cupSemiFinals + (finishRank >= 3 ? 1 : 0),
    cupQuarterFinals: existing.cupQuarterFinals + (finishRank >= 2 ? 1 : 0),
    longestCupMatchWinStreak: streak.longestStreak,
    currentCupMatchWinStreak: streak.currentStreak,
    currentTournamentWinsInRow: newTournamentRow,
    longestTournamentWinsInRow: Math.max(
      existing.longestTournamentWinsInRow,
      newTournamentRow
    ),
    lastUpdated: new Date().toISOString(),
  };

  profiles[name] = updated;
  saveProfiles(profiles);
  return updated;
}

/** Backfill cup leaderboard from saved career stats when profiles are missing. */
export function ensureCupLeaderboardSynced(
  username: string,
  normal: UserStatsData,
  hard: UserStatsData
): void {
  const profiles = loadProfiles();
  const existing = profiles[username];
  const statWins = normal.challengeCupWins + hard.challengeCupWins;
  const statLosses = normal.challengeCupLosses + hard.challengeCupLosses;

  if (
    existing &&
    existing.cupMatchWins >= statWins &&
    existing.cupsWon >= normal.challengeCupsWon + hard.challengeCupsWon
  ) {
    return;
  }

  if (statWins === 0 && statLosses === 0 && !existing) {
    return;
  }

  profiles[username] = {
    username,
    cupsWon: normal.challengeCupsWon + hard.challengeCupsWon,
    cupMatchWins: statWins,
    cupMatchLosses: statLosses,
    cupFinals: normal.challengeCupFinals + hard.challengeCupFinals,
    cupSemiFinals: normal.challengeCupSemiFinals + hard.challengeCupSemiFinals,
    cupQuarterFinals:
      normal.challengeCupQuarterFinals + hard.challengeCupQuarterFinals,
    longestCupMatchWinStreak: Math.max(
      normal.longestCupMatchWinStreak,
      hard.longestCupMatchWinStreak
    ),
    currentCupMatchWinStreak: Math.max(
      normal.currentCupMatchWinStreak,
      hard.currentCupMatchWinStreak
    ),
    longestTournamentWinsInRow: Math.max(
      normal.longestTournamentWinsInRow,
      hard.longestTournamentWinsInRow
    ),
    currentTournamentWinsInRow: Math.max(
      normal.currentTournamentWinsInRow,
      hard.currentTournamentWinsInRow
    ),
    lastUpdated: new Date().toISOString(),
  };
  saveProfiles(profiles);
}
