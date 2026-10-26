import { isLoggedIn, getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getUsername } from "./user";
import { isGuestLeaderboardName } from "./leaderboard";
import { STORAGE_KEYS } from "./keys";
import type { LeaderboardTrackerRow } from "../leaderboard-trackers";
import {
  getDailyChallengeBestStreak,
  getDailyChallengeDateKey,
  getDailyChallengeDayResult,
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

    const { error: upsertError } = await supabase.from("leaderboard").upsert(
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
    if (upsertError) throw upsertError;
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
      userId: entry.userId,
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

// ---------------------------------------------------------------------------------------------
// Daily score board (v1.18): today's counted attempt ranked by its Daily score (wins + bonuses,
// the Weekly formula). Table `daily_challenge_entries`, written only through the
// `submit_daily_challenge_entry` RPC, which recomputes the score server-side
// (supabase/migrations/20261027120000_challenge_score_rpcs.sql). Until that migration is applied
// the board shows the coach's own score from this device.
// ---------------------------------------------------------------------------------------------

const DAILY_SCORE_TABLE = "daily_challenge_entries";
const DAILY_SCORE_SYNC_KEY = "27-0-daily-score-synced";

interface DailyScoreSyncState {
  dayKey: string;
  runId: string;
  final: boolean;
}

function loadScoreSync(): DailyScoreSyncState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_SCORE_SYNC_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DailyScoreSyncState>) : null;
    if (parsed && typeof parsed.dayKey === "string" && typeof parsed.runId === "string") {
      return { dayKey: parsed.dayKey, runId: parsed.runId, final: parsed.final === true };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveScoreSync(state: DailyScoreSyncState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAILY_SCORE_SYNC_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

let dailyRpcUnavailable = false;
let dailyFlightInFlight: Promise<void> | null = null;

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || error.code === "42P01" || error.code === "PGRST205";
}

/**
 * Send today's counted Daily result to the board (signed-in coaches only). Safe to call often:
 * one request at a time, and a no-op once the final result is on the board.
 */
export function flushDailyScoreEntry(): Promise<void> {
  if (dailyFlightInFlight) return dailyFlightInFlight;
  if (dailyRpcUnavailable || !isSupabaseConfigured) return Promise.resolve();
  const userId = getAuthUserId();
  const coachName = getUsername();
  if (!isLoggedIn() || !userId || !coachName || isGuestLeaderboardName(coachName)) {
    return Promise.resolve();
  }
  const result = getDailyChallengeDayResult();
  if (!result || result.score <= 0) return Promise.resolve();
  const synced = loadScoreSync();
  if (
    synced &&
    synced.dayKey === result.dayKey &&
    synced.runId === result.runId &&
    (synced.final || !result.final)
  ) {
    return Promise.resolve();
  }
  dailyFlightInFlight = (async () => {
    const { error } = await supabase.rpc("submit_daily_challenge_entry", {
      p_day_key: result.dayKey,
      p_run_id: result.runId,
      p_coach_name: coachName,
      p_regular_wins: result.regularWins,
      p_league_leaders: result.leaguePosition === 1,
      p_playoff_wins: result.playoffWins,
      p_grand_final: result.grandFinal,
      p_is_final: result.final,
    });
    if (isMissingRpc(error)) {
      dailyRpcUnavailable = true;
      return;
    }
    if (error && error.code !== "23514" && error.code !== "P0001") throw error;
    // Accepted, or refused for good (closed day / another run already posted): stop retrying.
    saveScoreSync({ dayKey: result.dayKey, runId: result.runId, final: result.final || Boolean(error) });
  })()
    .catch((err) => {
      console.error("[daily-leaderboard] score submit failed:", err);
    })
    .finally(() => {
      dailyFlightInFlight = null;
    });
  return dailyFlightInFlight;
}

/**
 * A day's Daily board (today by default), ranked by Daily score; ties go to the earlier entry.
 * The signed-in coach's own result is merged in so it shows straight after a run.
 */
export async function getDailyScoreLeaderboardAsync(
  dayKey = getDailyChallengeDateKey(),
  limit = 50
): Promise<{ rows: LeaderboardTrackerRow[]; source: "remote" | "local" }> {
  const isToday = dayKey === getDailyChallengeDateKey();
  if (isToday) await flushDailyScoreEntry();
  const currentUser = getUsername() ?? "";
  const userId = getAuthUserId() ?? undefined;
  const mine = isToday ? getDailyChallengeDayResult() : null;

  type Entry = { userId?: string; username: string; score: number; createdAt: string };
  let remote: Entry[] | null = null;
  if (isSupabaseConfigured && !dailyRpcUnavailable) {
    try {
      const { data, error } = await supabase
        .from(DAILY_SCORE_TABLE)
        .select("user_id, coach_name, score, created_at")
        .eq("day_key", dayKey)
        .gt("score", 0)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      remote = (data ?? [])
        .filter((row) => typeof row.coach_name === "string" && typeof row.score === "number")
        .map((row) => ({
          userId: (row.user_id as string | null) ?? undefined,
          username: row.coach_name as string,
          score: row.score as number,
          createdAt: (row.created_at as string) ?? "",
        }));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "42P01" && code !== "PGRST205") {
        console.error("[daily-leaderboard] score board fetch failed:", err);
      }
      remote = null;
    }
  }

  const entries: Entry[] = [...(remote ?? [])];
  const loggedIn = isLoggedIn() && currentUser && !isGuestLeaderboardName(currentUser);
  if (mine && mine.score > 0) {
    const name = loggedIn ? currentUser : "You (this device)";
    const already = entries.some((e) => (userId && e.userId === userId) || e.username === name);
    if (!already) entries.push({ userId: loggedIn ? userId : undefined, username: name, score: mine.score, createdAt: new Date().toISOString() });
  }
  entries.sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.username.localeCompare(b.username));
  const rows: LeaderboardTrackerRow[] = entries.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    userId: entry.userId,
    statDisplay: String(entry.score),
    achievedAt: entry.createdAt,
    difficulty: "NORMAL",
    mode: "CLASSIC",
    isCurrentUser:
      (Boolean(userId) && entry.userId === userId) ||
      entry.username === currentUser ||
      entry.username === "You (this device)",
  }));
  return { rows, source: remote ? "remote" : "local" };
}
