import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import {
  getDailyChallengeDateKey,
  loadDailyChallengeSnapshot,
  applyDailyChallengeSnapshot,
  type DailyChallengeSnapshot,
  type DailyChallengeMeta,
  type DailyProgress,
} from "../daily-challenge";

/**
 * Daily Challenge cloud backup: one GLOBAL `user_stats` row holding streak meta, the per-day
 * claim map and today's counted attempt, so a second device picks up the same Daily state.
 */
const STAT_MODE = "GLOBAL";
const STAT_KEY = "daily_challenge";

const SAVE_DEBOUNCE_MS = 1_500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeMeta(raw: unknown): DailyChallengeMeta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Partial<DailyChallengeMeta>;
  return {
    currentStreak:
      typeof m.currentStreak === "number" && m.currentStreak >= 0
        ? Math.floor(m.currentStreak)
        : 0,
    bestStreak:
      typeof m.bestStreak === "number" && m.bestStreak >= 0 ? Math.floor(m.bestStreak) : 0,
    lastCompletedDateKey:
      typeof m.lastCompletedDateKey === "string" ? m.lastCompletedDateKey : null,
  };
}

function normalizeProgress(raw: unknown): Record<string, DailyProgress> {
  const out: Record<string, DailyProgress> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const p = (value && typeof value === "object" ? value : {}) as DailyProgress;
    const entry: DailyProgress = {};
    if (p.leagueLeaders) entry.leagueLeaders = true;
    if (p.playoffTitle) entry.playoffTitle = true;
    out[key] = entry;
  }
  return out;
}

function normalizeAttempt(raw: unknown): DailyChallengeSnapshot["attempt"] {
  const a = (raw && typeof raw === "object" ? raw : null) as
    | { date?: unknown; runId?: unknown }
    | null;
  if (a && typeof a.date === "string" && typeof a.runId === "string") {
    return { date: a.date, runId: a.runId };
  }
  return null;
}

function normalizeSnapshot(raw: unknown): DailyChallengeSnapshot {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<DailyChallengeSnapshot>;
  return {
    meta: normalizeMeta(s.meta),
    progress: normalizeProgress(s.progress),
    attempt: normalizeAttempt(s.attempt),
  };
}

function isComplete(p: DailyProgress | undefined): boolean {
  return Boolean(p?.leagueLeaders && p?.playoffTitle);
}

/** Previous calendar day for a YYYY-MM-DD key. */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

/**
 * Pure merge of a local and a cloud snapshot (exported for tests):
 * - progress maps are unioned per day
 * - bestStreak takes the higher
 * - currentStreak / lastCompletedDateKey follow whichever lastCompletedDateKey is later, then
 *   the streak is recomputed by walking back through the unioned claims from that day so days
 *   completed on either device count once
 * - today's counted attempt: the cloud's wins when present (so a second device doesn't get a
 *   fresh counted attempt); otherwise the local one is kept
 */
export function mergeDailySnapshots(
  local: DailyChallengeSnapshot,
  cloud: DailyChallengeSnapshot,
  todayKey: string
): DailyChallengeSnapshot {
  const progress: Record<string, DailyProgress> = {};
  for (const key of new Set([...Object.keys(local.progress), ...Object.keys(cloud.progress)])) {
    const a = local.progress[key] ?? {};
    const b = cloud.progress[key] ?? {};
    const entry: DailyProgress = {};
    if (a.leagueLeaders || b.leagueLeaders) entry.leagueLeaders = true;
    if (a.playoffTitle || b.playoffTitle) entry.playoffTitle = true;
    progress[key] = entry;
  }

  const localLast = local.meta.lastCompletedDateKey;
  const cloudLast = cloud.meta.lastCompletedDateKey;
  let lastCompletedDateKey: string | null;
  let baseStreak: number;
  if (localLast && cloudLast) {
    if (cloudLast > localLast) {
      lastCompletedDateKey = cloudLast;
      baseStreak = cloud.meta.currentStreak;
    } else if (localLast > cloudLast) {
      lastCompletedDateKey = localLast;
      baseStreak = local.meta.currentStreak;
    } else {
      lastCompletedDateKey = localLast;
      baseStreak = Math.max(local.meta.currentStreak, cloud.meta.currentStreak);
    }
  } else if (cloudLast) {
    lastCompletedDateKey = cloudLast;
    baseStreak = cloud.meta.currentStreak;
  } else {
    lastCompletedDateKey = localLast;
    baseStreak = local.meta.currentStreak;
  }

  // Recompute continuity: consecutive completed days (from the unioned claims) ending on the
  // latest completion day. Claims are trimmed to the last 60 days, so never go below the
  // streak the winning device already recorded.
  let currentStreak = baseStreak;
  if (lastCompletedDateKey) {
    let walked = 0;
    let key: string = lastCompletedDateKey;
    while (isComplete(progress[key]) && walked < 400) {
      walked += 1;
      key = previousDayKey(key);
    }
    if (walked === 0) walked = 1; // meta says it was completed even if the claim was trimmed
    currentStreak = Math.max(baseStreak, walked);
  } else {
    currentStreak = 0;
  }

  const bestStreak = Math.max(local.meta.bestStreak, cloud.meta.bestStreak, currentStreak);

  const cloudAttemptToday =
    cloud.attempt && cloud.attempt.date === todayKey ? cloud.attempt : null;
  const localAttemptToday =
    local.attempt && local.attempt.date === todayKey ? local.attempt : null;
  const attempt = cloudAttemptToday ?? localAttemptToday ?? null;

  return {
    meta: { currentStreak, bestStreak, lastCompletedDateKey },
    progress,
    attempt,
  };
}

async function upsertSnapshot(snapshot: DailyChallengeSnapshot): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: snapshot.meta.bestStreak,
        stat_json: snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[daily-challenge-cloud] save failed:", err);
  }
}

/** Upload the current local Daily state (debounced; guests are a no-op). */
export function saveDailyCloud(options?: { immediate?: boolean }): void {
  if (typeof window === "undefined") return;
  if (!getAuthUserId() || !isSupabaseConfigured) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const flush = () => {
    saveTimer = null;
    void upsertSnapshot(loadDailyChallengeSnapshot());
  };
  if (options?.immediate) {
    flush();
    return;
  }
  saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

/** On login: merge the cloud row into local storage and write the union back. */
export async function mergeDailyFromCloud(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", STAT_KEY)
      .maybeSingle();
    if (error) throw error;

    const local = loadDailyChallengeSnapshot();
    const cloud = data?.stat_json ? normalizeSnapshot(data.stat_json) : null;
    const merged = cloud ? mergeDailySnapshots(local, cloud, getDailyChallengeDateKey()) : local;
    if (cloud) applyDailyChallengeSnapshot(merged);
    // Always write back so a fresh account gets its first row (and merges reach the cloud).
    await upsertSnapshot(merged);
    // A streak built as a guest (or on another device) reaches the Daily board after login.
    if (merged.meta.bestStreak > 0) {
      void import("./daily-leaderboard").then(({ syncDailyChallengeLeaderboard }) =>
        syncDailyChallengeLeaderboard(merged.meta.bestStreak)
      );
    }
  } catch (err) {
    console.error("[daily-challenge-cloud] merge failed:", err);
  }
}
