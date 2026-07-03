import {
  getDefaultTrackerForManagerDbMode,
  getTrackersForManagerDbMode,
  isTrackerValidForManagerDbMode,
  rankByTracker,
  type LeaderboardTrackerEntry,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
  type ManagerLeaderboardDbMode,
} from "../leaderboard-trackers";
import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import {
  loadManagerStats,
} from "../manager/managerStats";
import type { ManagerLifetimeStats } from "../manager/types";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";

const LOCAL_GUEST_KEY = "__local_guest__";
const SUPER_LEAGUE_MODE = "manager-super-league";
const CHALLENGE_CUP_MODE = "manager-challenge-cup";
const EARNINGS_MODE = "manager-earnings";

export const MANAGER_LEADERBOARD_MODES: {
  id: ManagerLeaderboardDbMode;
  label: string;
}[] = [
  { id: "manager-super-league", label: "Super League" },
  { id: "manager-challenge-cup", label: "Challenge Cup" },
  { id: "manager-earnings", label: "Total Earnings" },
];

export {
  getDefaultTrackerForManagerDbMode,
  getTrackersForManagerDbMode,
  isTrackerValidForManagerDbMode,
  type ManagerLeaderboardDbMode,
};

interface ManagerScoreLeaderboardEntry {
  userId?: string;
  username: string;
  score: number;
  updatedAt: string;
}

interface ManagerTrackerLeaderboardEntry {
  userId?: string;
  username: string;
  stats: Omit<
    LeaderboardTrackerEntry,
    "username" | "achievedAt" | "difficulty" | "mode"
  >;
  updatedAt: string;
}

type LocalManagerLeaderboardStore = {
  tracker: Record<string, ManagerTrackerLeaderboardEntry>;
  earnings: Record<string, ManagerScoreLeaderboardEntry>;
};

function formatManagerEarnings(amount: number): string {
  if (amount >= 1_000_000) {
    return `£${(amount / 1_000_000).toFixed(1)}m`;
  }
  if (amount >= 1_000) {
    return `£${(amount / 1_000).toFixed(0)}k`;
  }
  return `£${amount}`;
}

function managerStatsToTrackerPayload(
  stats: ManagerLifetimeStats
): Omit<LeaderboardTrackerEntry, "username" | "achievedAt" | "difficulty" | "mode"> {
  const games = stats.wins + stats.losses;
  return {
    squadValue: 0,
    totalWins: stats.wins,
    totalLosses: stats.losses,
    perfectRuns: stats.perfectSeasons,
    winlessSeasons: stats.winlessSeasons,
    bestRecordWins: stats.wins,
    bestRecordLosses: stats.losses,
    bestWinPercentage: games > 0 ? (stats.wins / games) * 100 : 0,
    challengeCupWins: stats.challengeCups,
    cupFinals: stats.cupFinals,
    bestCupFinishRank: 0,
    bestCupFinishLabel: "",
    cupWinPercentage: 0,
    leagueTitles: stats.leagueTitles,
    superLeagueTitles: stats.superLeagueTitles,
  };
}

function hasManagerLeaderboardActivity(stats: ManagerLifetimeStats): boolean {
  return (
    stats.seasonsCompleted > 0 ||
    stats.careersStarted > 0 ||
    stats.wins > 0 ||
    stats.losses > 0 ||
    stats.leagueTitles > 0 ||
    stats.superLeagueTitles > 0 ||
    stats.challengeCups > 0 ||
    stats.totalEarnings > 0
  );
}

function loadLocalStore(): LocalManagerLeaderboardStore {
  if (typeof window === "undefined") {
    return { tracker: {}, earnings: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.managerLeaderboard);
    if (!raw) return { tracker: {}, earnings: {} };
    const parsed = JSON.parse(raw) as Partial<LocalManagerLeaderboardStore>;
    return {
      tracker: parsed.tracker ?? {},
      earnings: parsed.earnings ?? {},
    };
  } catch {
    return { tracker: {}, earnings: {} };
  }
}

function saveLocalStore(store: LocalManagerLeaderboardStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.managerLeaderboard, JSON.stringify(store));
}

function updateLocalTrackerEntry(
  username: string,
  stats: ManagerLifetimeStats,
  userId?: string
): void {
  const payload = managerStatsToTrackerPayload(stats);
  const store = loadLocalStore();
  const existing = store.tracker[username];
  store.tracker[username] = {
    username,
    stats: payload,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  saveLocalStore(store);
}

function updateLocalEarningsEntry(
  username: string,
  score: number,
  userId?: string
): void {
  if (score <= 0) return;
  const store = loadLocalStore();
  const existing = store.earnings[username];
  if (existing && existing.score >= score) return;
  store.earnings[username] = {
    username,
    score,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  saveLocalStore(store);
}

async function upsertTrackerModeOnline(
  mode: string,
  stats: ManagerLifetimeStats
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured
  ) {
    return;
  }

  const payload = managerStatsToTrackerPayload(stats);

  try {
    const { data: existing, error: selectError } = await supabase
      .from("leaderboard")
      .select("id")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .maybeSingle();

    if (selectError) throw selectError;

    const row = {
      coach_name: coachName,
      player_name: coachName,
      score: mode === SUPER_LEAGUE_MODE ? stats.leagueTitles : 0,
      wins: payload.totalWins,
      losses: payload.totalLosses,
      perfect_runs: payload.perfectRuns,
      winless_seasons: payload.winlessSeasons,
      best_record_wins: payload.bestRecordWins,
      best_record_losses: payload.bestRecordLosses,
      best_win_percentage: payload.bestWinPercentage,
      challenge_cup_wins: payload.challengeCupWins,
      cup_finals: payload.cupFinals,
      mode_variant: "current",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("leaderboard")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("leaderboard").insert({
      ...row,
      user_id: userId,
      mode,
      difficulty: "NORMAL",
    });
    if (error) throw error;
  } catch (err) {
    console.error("[manager-leaderboard] tracker submit failed:", err);
  }
}

async function upsertScoreModeOnline(
  mode: string,
  score: number
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    score <= 0
  ) {
    return;
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from("leaderboard")
      .select("id, score")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .maybeSingle();

    if (selectError) throw selectError;

    const currentScore =
      typeof existing?.score === "number" ? existing.score : 0;
    if (score < currentScore) return;

    const payload = {
      coach_name: coachName,
      player_name: coachName,
      score,
      mode_variant: "current",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("leaderboard")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("leaderboard").insert({
      ...payload,
      user_id: userId,
      mode,
      difficulty: "NORMAL",
    });
    if (error) throw error;
  } catch (err) {
    console.error("[manager-leaderboard] score submit failed:", err);
  }
}

export function syncManagerLeaderboard(
  stats: ManagerLifetimeStats = loadManagerStats()
): void {
  if (!hasManagerLeaderboardActivity(stats)) return;

  if (isLoggedIn()) {
    const username = getUsername();
    const userId = getAuthUserId() ?? undefined;
    if (!username || isGuestLeaderboardName(username)) return;

    updateLocalTrackerEntry(username, stats, userId);
    void upsertTrackerModeOnline(SUPER_LEAGUE_MODE, stats);
    void upsertTrackerModeOnline(CHALLENGE_CUP_MODE, stats);

    if (stats.totalEarnings > 0) {
      updateLocalEarningsEntry(username, stats.totalEarnings, userId);
      void upsertScoreModeOnline(EARNINGS_MODE, stats.totalEarnings);
    }
    return;
  }

  updateLocalTrackerEntry(LOCAL_GUEST_KEY, stats);
  if (stats.totalEarnings > 0) {
    updateLocalEarningsEntry(LOCAL_GUEST_KEY, stats.totalEarnings);
  }
}

export function syncManagerLeaderboardOnLoad(): void {
  syncManagerLeaderboard();
}

function filterPublicScoreEntries(
  entries: ManagerScoreLeaderboardEntry[]
): ManagerScoreLeaderboardEntry[] {
  return entries.filter((entry) => !isGuestLeaderboardName(entry.username));
}

function mergeScoreEntries(
  ...groups: ManagerScoreLeaderboardEntry[][]
): ManagerScoreLeaderboardEntry[] {
  const byKey = new Map<string, ManagerScoreLeaderboardEntry>();

  for (const group of groups) {
    for (const entry of group) {
      if (isGuestLeaderboardName(entry.username) || entry.score <= 0) continue;
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (!existing || entry.score > existing.score) {
        byKey.set(key, entry);
      } else if (
        existing &&
        entry.score === existing.score &&
        entry.updatedAt > existing.updatedAt
      ) {
        byKey.set(key, { ...existing, username: entry.username });
      }
    }
  }

  return [...byKey.values()];
}

function isCurrentUserEntry(
  username: string,
  userId: string | undefined,
  currentUser: string,
  entryUserId?: string
): boolean {
  if (userId && entryUserId === userId) return true;
  if (currentUser && username === currentUser) return true;
  if (username === "You" && !userId && !currentUser) return true;
  return false;
}

function mapScoreEntriesToRows(
  entries: ManagerScoreLeaderboardEntry[],
  currentUser: string,
  userId: string | undefined,
  limit: number,
  formatScore: (score: number) => string
): LeaderboardTrackerRow[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const rows = sorted.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    statDisplay: formatScore(entry.score),
    achievedAt: entry.updatedAt,
    difficulty: "NORMAL" as const,
    mode: "CLASSIC" as const,
    isCurrentUser: isCurrentUserEntry(
      entry.username,
      userId,
      currentUser,
      entry.userId
    ),
  }));

  if (!rows.some((row) => row.isCurrentUser)) {
    const userIndex = sorted.findIndex((entry) =>
      isCurrentUserEntry(entry.username, userId, currentUser, entry.userId)
    );
    if (userIndex >= 0) {
      const entry = sorted[userIndex]!;
      rows.push({
        rank: userIndex + 1,
        username: entry.username,
        statDisplay: formatScore(entry.score),
        achievedAt: entry.updatedAt,
        difficulty: "NORMAL",
        mode: "CLASSIC",
        isCurrentUser: true,
      });
    }
  }

  return rows;
}

async function fetchRemoteTrackerEntries(
  mode: string
): Promise<LeaderboardTrackerEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select(
        "coach_name, score, wins, losses, perfect_runs, winless_seasons, best_record_wins, best_record_losses, best_win_percentage, challenge_cup_wins, cup_finals, updated_at, created_at"
      )
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data?.length) return [];

    return data
      .filter((row) => row.coach_name)
      .map((row) => ({
        username: row.coach_name as string,
        squadValue: 0,
        achievedAt:
          (row.updated_at as string) ?? (row.created_at as string) ?? "",
        difficulty: "NORMAL" as const,
        mode: "CLASSIC" as const,
        totalWins: row.wins ?? 0,
        totalLosses: row.losses ?? 0,
        perfectRuns: row.perfect_runs ?? 0,
        winlessSeasons: row.winless_seasons ?? 0,
        bestRecordWins: row.best_record_wins ?? row.wins ?? 0,
        bestRecordLosses: row.best_record_losses ?? row.losses ?? 0,
        bestWinPercentage: row.best_win_percentage ?? 0,
        challengeCupWins: row.challenge_cup_wins ?? 0,
        cupFinals: row.cup_finals ?? 0,
        bestCupFinishRank: 0,
        bestCupFinishLabel: "",
        cupWinPercentage: 0,
        leagueTitles: typeof row.score === "number" ? row.score : 0,
        superLeagueTitles: 0,
      }));
  } catch (err) {
    console.error("[manager-leaderboard] tracker fetch failed:", err);
    return null;
  }
}

async function fetchRemoteScoreEntries(
  mode: string
): Promise<ManagerScoreLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at, created_at")
      .eq("mode", mode)
      .eq("difficulty", "NORMAL")
      .eq("mode_variant", "current")
      .gt("score", 0)
      .order("score", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!data?.length) return [];

    return data
      .filter((row) => row.coach_name && typeof row.score === "number")
      .map((row) => ({
        userId: (row.user_id as string | null) ?? undefined,
        username: row.coach_name as string,
        score: row.score as number,
        updatedAt:
          (row.updated_at as string) ?? (row.created_at as string) ?? "",
      }));
  } catch (err) {
    console.error("[manager-leaderboard] score fetch failed:", err);
    return null;
  }
}

function buildLiveTrackerEntry(
  stats: ManagerLifetimeStats,
  currentUser: string
): LeaderboardTrackerEntry | null {
  if (!hasManagerLeaderboardActivity(stats)) return null;
  if (currentUser && !isGuestLeaderboardName(currentUser)) {
    return {
      username: currentUser,
      achievedAt: new Date().toISOString(),
      difficulty: "NORMAL",
      mode: "CLASSIC",
      ...managerStatsToTrackerPayload(stats),
    };
  }
  return {
    username: "You",
    achievedAt: new Date().toISOString(),
    difficulty: "NORMAL",
    mode: "CLASSIC",
    ...managerStatsToTrackerPayload(stats),
  };
}

function buildLocalTrackerEntries(): LeaderboardTrackerEntry[] {
  const store = loadLocalStore();
  return Object.values(store.tracker)
    .filter((entry) => !isGuestLeaderboardName(entry.username))
    .map((entry) => ({
      username: entry.username,
      achievedAt: entry.updatedAt,
      difficulty: "NORMAL" as const,
      mode: "CLASSIC" as const,
      ...entry.stats,
    }));
}

function buildLocalEarningsEntries(): ManagerScoreLeaderboardEntry[] {
  return filterPublicScoreEntries(Object.values(loadLocalStore().earnings));
}

async function getManagerTrackerLeaderboardAsync(
  dbMode: "manager-super-league" | "manager-challenge-cup",
  tracker: LeaderboardTrackerType,
  limit: number
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const stats = loadManagerStats();
  const remoteMode =
    dbMode === "manager-super-league" ? SUPER_LEAGUE_MODE : CHALLENGE_CUP_MODE;

  syncManagerLeaderboard(stats);

  const liveEntry = buildLiveTrackerEntry(stats, currentUser);
  const remote = await fetchRemoteTrackerEntries(remoteMode);
  const local = buildLocalTrackerEntries();

  const merged = new Map<string, LeaderboardTrackerEntry>();
  if (remote !== null) {
    for (const entry of remote) {
      merged.set(entry.username.toLowerCase(), entry);
    }
  } else {
    for (const entry of local) {
      merged.set(entry.username.toLowerCase(), entry);
    }
  }
  if (liveEntry) {
    merged.set(liveEntry.username.toLowerCase(), liveEntry);
  }

  let entries = [...merged.values()];
  if (tracker === "manager_league_titles") {
    entries = entries.filter((entry) => entry.leagueTitles > 0);
  }

  return {
    source: remote !== null ? "remote" : "local",
    rows: rankByTracker(entries, tracker, limit, currentUser),
  };
}

async function getManagerEarningsLeaderboardAsync(
  limit: number
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const stats = loadManagerStats();
  const currentTotal = stats.totalEarnings;

  syncManagerLeaderboard(stats);

  const liveEntry =
    currentTotal > 0
      ? {
          username:
            currentUser && !isGuestLeaderboardName(currentUser)
              ? currentUser
              : "You",
          score: currentTotal,
          updatedAt: new Date().toISOString(),
          userId,
        }
      : null;

  const remote = await fetchRemoteScoreEntries(EARNINGS_MODE);
  const merged = mergeScoreEntries(
    remote ?? [],
    buildLocalEarningsEntries(),
    liveEntry ? [liveEntry] : []
  );

  return {
    source: remote !== null ? "remote" : "local",
    rows: mapScoreEntriesToRows(
      merged,
      currentUser,
      userId,
      limit,
      formatManagerEarnings
    ),
  };
}

export async function getManagerLeaderboardAsync(
  dbMode: ManagerLeaderboardDbMode,
  tracker: LeaderboardTrackerType,
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  if (dbMode === "manager-earnings") {
    return getManagerEarningsLeaderboardAsync(limit);
  }

  if (
    dbMode === "manager-super-league" ||
    dbMode === "manager-challenge-cup"
  ) {
    return getManagerTrackerLeaderboardAsync(dbMode, tracker, limit);
  }

  return { rows: [], source: "local" };
}
