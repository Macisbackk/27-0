import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";
import {
  getDailyChallengeBestStreak,
} from "../daily-challenge";

const LEADERBOARD_MODE = "daily";
const LOCAL_GUEST_KEY = "__local_guest__";

export interface DailyLeaderboardEntry {
  userId?: string;
  username: string;
  bestStreak: number;
  updatedAt: string;
}

function loadLocalEntries(): Record<string, DailyLeaderboardEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyLeaderboard);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DailyLeaderboardEntry>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function saveLocalEntries(entries: Record<string, DailyLeaderboardEntry>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.dailyLeaderboard, JSON.stringify(entries));
}

export function updateLocalDailyLeaderboard(
  username: string,
  bestStreak: number,
  userId?: string
): void {
  if (!username || bestStreak <= 0) return;
  const entries = loadLocalEntries();
  const existing = entries[username];
  if (existing && existing.bestStreak >= bestStreak) return;
  entries[username] = {
    username,
    bestStreak,
    updatedAt: new Date().toISOString(),
    userId: userId ?? existing?.userId,
  };
  saveLocalEntries(entries);
}

export async function submitDailyLeaderboardOnline(
  bestStreak: number
): Promise<void> {
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (
    !userId ||
    !coachName ||
    isGuestLeaderboardName(coachName) ||
    !isSupabaseConfigured ||
    bestStreak <= 0
  ) {
    return;
  }

  try {
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("score")
      .eq("user_id", userId)
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
      .maybeSingle();

    const currentScore =
      typeof existing?.score === "number" ? existing.score : 0;
    if (bestStreak < currentScore) return;

    await supabase.from("leaderboard").upsert(
      {
        user_id: userId,
        coach_name: coachName,
        player_name: coachName,
        mode: LEADERBOARD_MODE,
        difficulty: "NORMAL",
        mode_variant: "current",
        score: bestStreak,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,difficulty,mode_variant" }
    );
  } catch (err) {
    console.error("[daily-leaderboard] submit failed:", err);
  }
}

export function syncDailyChallengeLeaderboard(bestStreak: number): void {
  if (bestStreak <= 0) return;

  if (isLoggedIn()) {
    const username = getUsername();
    if (!username || isGuestLeaderboardName(username)) return;
    updateLocalDailyLeaderboard(username, bestStreak, getAuthUserId() ?? undefined);
    void submitDailyLeaderboardOnline(bestStreak);
    return;
  }

  updateLocalDailyLeaderboard(LOCAL_GUEST_KEY, bestStreak);
}

function filterPublicEntries(
  entries: DailyLeaderboardEntry[]
): DailyLeaderboardEntry[] {
  return entries.filter((entry) => !isGuestLeaderboardName(entry.username));
}

function mergeDailyEntries(
  ...groups: DailyLeaderboardEntry[][]
): DailyLeaderboardEntry[] {
  const byKey = new Map<string, DailyLeaderboardEntry>();

  for (const group of groups) {
    for (const entry of group) {
      if (isGuestLeaderboardName(entry.username) || entry.bestStreak <= 0) {
        continue;
      }
      const key = entry.userId ?? entry.username.toLowerCase();
      const existing = byKey.get(key);
      if (!existing || entry.bestStreak > existing.bestStreak) {
        byKey.set(key, entry);
      } else if (
        existing &&
        entry.bestStreak === existing.bestStreak &&
        entry.updatedAt > existing.updatedAt
      ) {
        byKey.set(key, { ...existing, username: entry.username });
      }
    }
  }

  return [...byKey.values()];
}

function mapEntriesToRows(
  entries: DailyLeaderboardEntry[],
  currentUser: string,
  limit: number
): LeaderboardTrackerRow[] {
  return [...entries]
    .sort((a, b) => b.bestStreak - a.bestStreak)
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      statDisplay: String(entry.bestStreak),
      achievedAt: "",
      difficulty: "NORMAL",
      mode: "CLASSIC",
      isCurrentUser: entry.username === currentUser,
    }));
}

async function fetchRemoteEntries(): Promise<DailyLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, coach_name, score, updated_at")
      .eq("mode", LEADERBOARD_MODE)
      .eq("difficulty", "NORMAL")
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
        bestStreak: row.score as number,
        updatedAt: (row.updated_at as string) ?? "",
      }));
  } catch (err) {
    console.error("[daily-leaderboard] fetch failed:", err);
    return null;
  }
}

function buildLocalFallbackEntries(
  currentUser: string,
  bestStreak: number,
  userId?: string
): DailyLeaderboardEntry[] {
  const local = filterPublicEntries(Object.values(loadLocalEntries()));
  const merged = mergeDailyEntries(local);

  if (
    isLoggedIn() &&
    currentUser &&
    !isGuestLeaderboardName(currentUser) &&
    bestStreak > 0
  ) {
    return mergeDailyEntries(merged, [
      {
        username: currentUser,
        bestStreak,
        updatedAt: new Date().toISOString(),
        userId,
      },
    ]);
  }

  return merged;
}

export async function getDailyLeaderboardAsync(
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const bestStreak = getDailyChallengeBestStreak();

  if (isLoggedIn() && bestStreak > 0 && currentUser) {
    updateLocalDailyLeaderboard(currentUser, bestStreak, userId);
    void submitDailyLeaderboardOnline(bestStreak);
  } else if (!isLoggedIn() && bestStreak > 0) {
    updateLocalDailyLeaderboard(LOCAL_GUEST_KEY, bestStreak);
  }

  const remote = await fetchRemoteEntries();
  if (remote !== null) {
    const merged = mergeDailyEntries(
      remote,
      isLoggedIn() &&
        currentUser &&
        !isGuestLeaderboardName(currentUser) &&
        bestStreak > 0
        ? [
            {
              username: currentUser,
              bestStreak,
              updatedAt: new Date().toISOString(),
              userId,
            },
          ]
        : []
    );

    return {
      source: "remote",
      rows: mapEntriesToRows(filterPublicEntries(merged), currentUser, limit),
    };
  }

  const local = buildLocalFallbackEntries(currentUser, bestStreak, userId);
  return {
    source: "local",
    rows: mapEntriesToRows(local, currentUser, limit),
  };
}
