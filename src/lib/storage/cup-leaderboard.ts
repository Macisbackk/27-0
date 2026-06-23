import { applyMatchResultsToStreak, getCupFinishRank } from "../cup-ranking";
import type { LeaderboardTrackerEntry } from "../leaderboard-trackers";
import type { GameDifficulty, UserStatsData } from "../types";
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
  const name = username ?? getUsername() ?? "Unknown";
  const profiles = loadProfiles();
  return profiles[name] ?? emptyProfile(name);
}

export function updateCupLeaderboardProfile(
  input: CupRunInput,
  username?: string
): CupLeaderboardProfile {
  const name = username ?? getUsername() ?? "Unknown";
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

export interface EraCupLeaderboardProfile {
  username: string;
  cupsWon: number;
  cupMatchWins: number;
  cupMatchLosses: number;
  longestCupMatchWinStreak: number;
  currentCupMatchWinStreak: number;
  longestTournamentWinsInRow: number;
  currentTournamentWinsInRow: number;
  lastUpdated: string;
}

function emptyEraProfile(username: string): EraCupLeaderboardProfile {
  return {
    username,
    cupsWon: 0,
    cupMatchWins: 0,
    cupMatchLosses: 0,
    longestCupMatchWinStreak: 0,
    currentCupMatchWinStreak: 0,
    longestTournamentWinsInRow: 0,
    currentTournamentWinsInRow: 0,
    lastUpdated: new Date(0).toISOString(),
  };
}

function loadEraProfiles(): Record<string, EraCupLeaderboardProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.eraCupLeaderboard);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EraCupLeaderboardProfile>;
  } catch {
    return {};
  }
}

function saveEraProfiles(profiles: Record<string, EraCupLeaderboardProfile>): void {
  localStorage.setItem(
    STORAGE_KEYS.eraCupLeaderboard,
    JSON.stringify(profiles)
  );
}

export function getAllEraCupLeaderboardProfiles(): EraCupLeaderboardProfile[] {
  return Object.values(loadEraProfiles()).sort((a, b) =>
    a.username.localeCompare(b.username)
  );
}

export function updateEraCupLeaderboardProfile(
  input: CupRunInput,
  username?: string
): EraCupLeaderboardProfile {
  const name = username ?? getUsername() ?? "Unknown";
  const profiles = loadEraProfiles();
  const existing = profiles[name] ?? emptyEraProfile(name);

  const streak = applyMatchResultsToStreak(
    existing.currentCupMatchWinStreak,
    existing.longestCupMatchWinStreak,
    input.matchResults
  );
  const newTournamentRow = input.cupWon
    ? existing.currentTournamentWinsInRow + 1
    : 0;

  const updated: EraCupLeaderboardProfile = {
    ...existing,
    username: name,
    cupMatchWins: existing.cupMatchWins + input.wins,
    cupMatchLosses: existing.cupMatchLosses + input.losses,
    cupsWon: existing.cupsWon + (input.cupWon ? 1 : 0),
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
  saveEraProfiles(profiles);
  return updated;
}

/** Backfill era cup leaderboard from saved career stats when profiles are missing. */
export function ensureEraCupLeaderboardSynced(
  username: string,
  eraCup: UserStatsData
): void {
  const profiles = loadEraProfiles();
  const existing = profiles[username];
  const statWins = eraCup.eraChallengeCupWins;
  const statLosses = eraCup.eraChallengeCupLosses;

  if (
    existing &&
    existing.cupMatchWins >= statWins &&
    existing.cupsWon >= eraCup.eraCupsWon
  ) {
    return;
  }

  if (statWins === 0 && statLosses === 0 && eraCup.eraChallengeCupRuns === 0) {
    return;
  }

  profiles[username] = {
    username,
    cupsWon: eraCup.eraCupsWon,
    cupMatchWins: statWins,
    cupMatchLosses: statLosses,
    longestCupMatchWinStreak: 0,
    currentCupMatchWinStreak: 0,
    longestTournamentWinsInRow: 0,
    currentTournamentWinsInRow: 0,
    lastUpdated: new Date().toISOString(),
  };
  saveEraProfiles(profiles);
}

/** Map local cup profile storage into leaderboard tracker entries. */
export function mapCupProfilesToTrackerEntries(
  profiles: Array<{
    username: string;
    cupsWon: number;
    cupMatchWins: number;
    cupMatchLosses: number;
    lastUpdated: string;
  }>
): LeaderboardTrackerEntry[] {
  return profiles.map((profile) => {
    const games = profile.cupMatchWins + profile.cupMatchLosses;
    const winPct = games > 0 ? (profile.cupMatchWins / games) * 100 : 0;
    return {
      username: profile.username,
      squadValue: 0,
      achievedAt: profile.lastUpdated,
      difficulty: "NORMAL" as GameDifficulty,
      mode: "CHALLENGE_CUP",
      totalWins: profile.cupMatchWins,
      totalLosses: profile.cupMatchLosses,
      perfectRuns: 0,
      bestRecordWins: profile.cupMatchWins,
      bestRecordLosses: profile.cupMatchLosses,
      bestWinPercentage: winPct,
      challengeCupWins: profile.cupsWon,
      cupFinals: 0,
      bestCupFinishRank: 0,
      bestCupFinishLabel: "",
      cupWinPercentage: winPct,
    };
  });
}
