import { combineLeaderboardTrackerStats } from "../leaderboard-trackers";
import type { GameDifficulty, GameMode, LeaderboardPeriod } from "../types";
import { mergeUserStatsData } from "./merge-user-stats";
import { EMPTY_STATS, migrateUserStats, type StoredStats } from "./stats";
import { STORAGE_KEYS } from "./keys";

export const PRIMARY_COACH = "coachbeard";
export const SECONDARY_COACH = "coachbeard2";

export { combineLeaderboardTrackerStats };

export interface CoachbeardMergeReport {
  skipped: boolean;
  reason?: string;
  hadSecondaryData: boolean;
  leaderboardEntriesMerged: number;
  clubFundsLeaderboardMerged: boolean;
  statsMerged: boolean;
  coachbeard2StillVisible: boolean;
  validation: {
    singleCoachProfile: boolean;
    secondaryRemoved: boolean;
  };
}

function isSecondaryName(name: unknown): boolean {
  return typeof name === "string" && name.trim().toLowerCase() === SECONDARY_COACH.toLowerCase();
}

function isPrimaryName(name: unknown): boolean {
  return typeof name === "string" && name.trim().toLowerCase() === PRIMARY_COACH.toLowerCase();
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads saved JSON, keeping the fallback's shape: this runs on every page, so a damaged or
 * hand-edited value (null, a number, an array of junk) must never throw.
 */
function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed.filter(isRecord) : fallback) as T;
    if (isRecord(fallback)) {
      if (!isRecord(parsed)) return fallback;
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isRecord(v))) as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function hasSecondaryLocalData(): boolean {
  if (typeof window === "undefined") return false;

  const leaderboard = loadJson<unknown[]>(STORAGE_KEYS.leaderboard, []);
  if (
    Array.isArray(leaderboard) &&
    leaderboard.some(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        "username" in e &&
        isSecondaryName(String((e as { username: string }).username))
    )
  ) {
    return true;
  }

  const fundsLb = loadJson<Record<string, unknown>>(
    STORAGE_KEYS.clubFundsLeaderboard,
    {}
  );
  if (Object.keys(fundsLb).some((k) => isSecondaryName(k))) return true;

  const legacyName = localStorage.getItem(STORAGE_KEYS.username);
  if (legacyName && isSecondaryName(legacyName)) return true;

  return false;
}

function coachbeard2StillVisibleLocally(): boolean {
  if (typeof window === "undefined") return false;

  const leaderboard = loadJson<{ username?: string }[]>(
    STORAGE_KEYS.leaderboard,
    []
  );
  return leaderboard.some((e) => isSecondaryName(e.username ?? ""));
}

function mergeLocalLeaderboardEntries(): number {
  type LocalEntry = {
    id: string;
    username: string;
    squadValue: number;
    achievedAt: string;
    period: LeaderboardPeriod;
    periodKey: string;
    mode: GameMode;
    difficulty: GameDifficulty;
    totalWins: number;
    totalLosses: number;
    perfectRuns: number;
    bestRecordWins: number;
    bestRecordLosses: number;
    bestWinPercentage: number;
    challengeCupWins: number;
    cupFinals: number;
    bestCupFinishRank: number;
    bestCupFinishLabel: string;
    cupWinPercentage: number;
    modeVariant?: "current" | "era";
  };

  const entries = loadJson<LocalEntry[]>(STORAGE_KEYS.leaderboard, []);

  const secondary = entries.filter((e) => isSecondaryName(e.username));
  if (secondary.length === 0) return 0;

  let mergedCount = 0;
  const remaining = entries.filter((e) => !isSecondaryName(e.username));

  for (const sec of secondary) {
    const matchIdx = remaining.findIndex(
      (e) =>
        isPrimaryName(e.username) &&
        e.mode === sec.mode &&
        e.difficulty === sec.difficulty &&
        e.period === sec.period &&
        e.periodKey === sec.periodKey &&
        (e.modeVariant ?? "current") === (sec.modeVariant ?? "current")
    );

    if (matchIdx >= 0) {
      const primary = remaining[matchIdx];
      const combined = combineLeaderboardTrackerStats(primary, sec);
      remaining[matchIdx] = {
        ...primary,
        ...combined,
        username: PRIMARY_COACH,
        achievedAt: [primary.achievedAt, sec.achievedAt].sort().pop()!,
      };
    } else {
      remaining.push({
        ...sec,
        username: PRIMARY_COACH,
      });
    }
    mergedCount++;
  }

  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(remaining));
  return mergedCount;
}

function mergeClubFundsLeaderboardLocal(): boolean {
  const entries = loadJson<
    Record<string, { username: string; totalEarned: number; updatedAt: string }>
  >(STORAGE_KEYS.clubFundsLeaderboard, {});

  const secondaryKey = Object.keys(entries).find((k) => isSecondaryName(k));
  if (!secondaryKey) return false;

  const secondary = entries[secondaryKey];
  const primaryKey = Object.keys(entries).find((k) => isPrimaryName(k));
  const primary = primaryKey ? entries[primaryKey] : null;

  entries[PRIMARY_COACH] = {
    username: PRIMARY_COACH,
    totalEarned: Math.max(Number(primary?.totalEarned) || 0, Number(secondary.totalEarned) || 0),
    updatedAt: [String(primary?.updatedAt ?? ""), String(secondary.updatedAt ?? "")].sort().pop()!,
  };
  delete entries[secondaryKey];
  if (primaryKey && primaryKey !== PRIMARY_COACH) {
    delete entries[primaryKey];
  }

  localStorage.setItem(
    STORAGE_KEYS.clubFundsLeaderboard,
    JSON.stringify(entries)
  );
  return true;
}

function mergeClubFundsState(): void {
  const raw = localStorage.getItem(STORAGE_KEYS.clubFunds);
  if (!raw) return;
  try {
    const state = JSON.parse(raw) as {
      balance: number;
      totalEarned: number;
      paidRunIds: string[];
    } | null;
    if (!isRecord(state)) return;
    const paidSet = new Set(Array.isArray(state.paidRunIds) ? state.paidRunIds : []);
    localStorage.setItem(
      STORAGE_KEYS.clubFunds,
      JSON.stringify({
        balance: state.balance ?? 0,
        totalEarned: state.totalEarned ?? state.balance ?? 0,
        paidRunIds: [...paidSet],
      })
    );
  } catch {
    /* ignore */
  }
}

function mergeLocalStatsIfNeeded(
  coachName: string | null,
  email: string | null,
  hadOnlySecondary: boolean
): boolean {
  // Matched by coach name only (no personal details in the shipped code).
  void email;
  const isTargetUser = Boolean(coachName && isPrimaryName(coachName));

  if (!isTargetUser && !hadOnlySecondary) return false;

  const raw = localStorage.getItem(STORAGE_KEYS.stats);
  if (!raw) return false;

  let local: StoredStats;
  try {
    local = JSON.parse(raw) as StoredStats;
    if (!isRecord(local)) return false;
  } catch {
    return false;
  }

  const backupRaw = localStorage.getItem(`${STORAGE_KEYS.stats}-coachbeard2-snapshot`);
  let secondary: StoredStats | null = null;
  if (backupRaw) {
    try {
      secondary = JSON.parse(backupRaw) as StoredStats;
      if (!isRecord(secondary)) secondary = null;
    } catch {
      secondary = null;
    }
  }

  if (!secondary && hadOnlySecondary) {
    return false;
  }

  if (!secondary) return false;

  const merged: StoredStats = {
    normal: mergeUserStatsData(
      migrateUserStats(secondary.normal ?? EMPTY_STATS),
      migrateUserStats(local.normal ?? EMPTY_STATS)
    ),
    hard: mergeUserStatsData(
      migrateUserStats(secondary.hard ?? EMPTY_STATS),
      migrateUserStats(local.hard ?? EMPTY_STATS)
    ),
    draftNormal: mergeUserStatsData(
      migrateUserStats(secondary.draftNormal ?? EMPTY_STATS),
      migrateUserStats(local.draftNormal ?? EMPTY_STATS)
    ),
    draftHard: mergeUserStatsData(
      migrateUserStats(secondary.draftHard ?? EMPTY_STATS),
      migrateUserStats(local.draftHard ?? EMPTY_STATS)
    ),
    fantasy: mergeUserStatsData(
      migrateUserStats(secondary.fantasy ?? EMPTY_STATS),
      migrateUserStats(local.fantasy ?? EMPTY_STATS)
    ),
    eraNormal: mergeUserStatsData(
      migrateUserStats(secondary.eraNormal ?? EMPTY_STATS),
      migrateUserStats(local.eraNormal ?? EMPTY_STATS)
    ),
  };

  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(merged));
  localStorage.removeItem(`${STORAGE_KEYS.stats}-coachbeard2-snapshot`);
  return true;
}

function snapshotStatsForSecondaryIfNeeded(): void {
  const snapshotKey = `${STORAGE_KEYS.stats}-coachbeard2-snapshot`;
  if (localStorage.getItem(snapshotKey)) return;

  const leaderboard = loadJson<{ username?: string }[]>(
    STORAGE_KEYS.leaderboard,
    []
  );
  const hasSecondary = leaderboard.some((e) => isSecondaryName(e.username ?? ""));
  const hasPrimary = leaderboard.some((e) => isPrimaryName(e.username ?? ""));

  if (hasSecondary && !hasPrimary) {
    const stats = localStorage.getItem(STORAGE_KEYS.stats);
    if (stats) {
      localStorage.setItem(snapshotKey, stats);
    }
  }
}

export function isCoachbeardMergeComplete(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.coachbeardMergeComplete) === "1";
}

export function runCoachbeardAccountMergeLocal(options: {
  coachName: string | null;
  email: string | null;
}): CoachbeardMergeReport {
  if (typeof window === "undefined") {
    return {
      skipped: true,
      reason: "server",
      hadSecondaryData: false,
      leaderboardEntriesMerged: 0,
      clubFundsLeaderboardMerged: false,
      statsMerged: false,
      coachbeard2StillVisible: false,
      validation: { singleCoachProfile: true, secondaryRemoved: true },
    };
  }

  if (isCoachbeardMergeComplete()) {
    return {
      skipped: true,
      reason: "already_complete",
      hadSecondaryData: false,
      leaderboardEntriesMerged: 0,
      clubFundsLeaderboardMerged: false,
      statsMerged: false,
      coachbeard2StillVisible: coachbeard2StillVisibleLocally(),
      validation: {
        singleCoachProfile: !coachbeard2StillVisibleLocally(),
        secondaryRemoved: !coachbeard2StillVisibleLocally(),
      },
    };
  }

  const hadSecondary = hasSecondaryLocalData();
  if (!hadSecondary) {
    localStorage.setItem(STORAGE_KEYS.coachbeardMergeComplete, "1");
    return {
      skipped: true,
      reason: "no_secondary_data",
      hadSecondaryData: false,
      leaderboardEntriesMerged: 0,
      clubFundsLeaderboardMerged: false,
      statsMerged: false,
      coachbeard2StillVisible: false,
      validation: { singleCoachProfile: true, secondaryRemoved: true },
    };
  }

  const leaderboard = loadJson<{ username?: string }[]>(
    STORAGE_KEYS.leaderboard,
    []
  );
  const hadOnlySecondary =
    leaderboard.some((e) => isSecondaryName(e.username ?? "")) &&
    !leaderboard.some((e) => isPrimaryName(e.username ?? ""));

  snapshotStatsForSecondaryIfNeeded();

  const leaderboardEntriesMerged = mergeLocalLeaderboardEntries();
  const clubFundsLeaderboardMerged = mergeClubFundsLeaderboardLocal();
  mergeClubFundsState();

  const legacyName = localStorage.getItem(STORAGE_KEYS.username);
  if (legacyName && isSecondaryName(legacyName)) {
    localStorage.setItem(STORAGE_KEYS.username, PRIMARY_COACH);
  }

  const statsMerged = mergeLocalStatsIfNeeded(
    options.coachName,
    options.email,
    hadOnlySecondary
  );

  localStorage.setItem(STORAGE_KEYS.coachbeardMergeComplete, "1");

  const coachbeard2StillVisible = coachbeard2StillVisibleLocally();

  return {
    skipped: false,
    hadSecondaryData: true,
    leaderboardEntriesMerged,
    clubFundsLeaderboardMerged,
    statsMerged,
    coachbeard2StillVisible,
    validation: {
      singleCoachProfile: !coachbeard2StillVisible,
      secondaryRemoved: !coachbeard2StillVisible,
    },
  };
}
