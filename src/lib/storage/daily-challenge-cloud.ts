import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import {
  computeDailyScore,
  countStreakFromProgress,
  DAILY_MAX_FREEZES,
  DAILY_STREAK_RULES_VERSION,
  isFinishedDay,
  migrateDailyState,
  normalizeDailyMeta,
  normalizeDailyProgressMap,
} from "../daily-streak";
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
  return normalizeDailyMeta(raw);
}

function normalizeProgress(raw: unknown): Record<string, DailyProgress> {
  return normalizeDailyProgressMap(raw);
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

function mergeResult(
  a: DailyProgress["result"],
  b: DailyProgress["result"]
): DailyProgress["result"] {
  if (!a) return b;
  if (!b) return a;
  // Same counted attempt on both: the final (play-offs included) copy wins.
  if (a.runId === b.runId) return a.final || !b.final ? a : b;
  return computeDailyScore(a) >= computeDailyScore(b) ? a : b;
}

/**
 * Pure merge of a local and a cloud snapshot (exported for tests):
 * - progress maps are unioned per day (finished / frozen / perfect / bonus flags OR-ed; the
 *   day's result keeps the final or higher-scoring copy)
 * - bestStreak and perfectDays take the higher
 * - currentStreak / lastCompletedDateKey / freezes follow whichever lastCompletedDateKey is
 *   later (ties keep the higher streak and the higher freeze count), then the streak is
 *   recomputed by walking back through the unioned days so days finished on either device
 *   count once (frozen days bridge gaps)
 * - pre-v1.18 snapshots are migrated first (a claim of either bonus = a finished day), so an
 *   older device never wipes a streak
 * - today's counted attempt: the cloud's wins when present (so a second device doesn't get a
 *   fresh counted attempt); otherwise the local one is kept
 */
export function mergeDailySnapshots(
  localIn: DailyChallengeSnapshot,
  cloudIn: DailyChallengeSnapshot,
  todayKey: string
): DailyChallengeSnapshot {
  const lm = migrateDailyState(normalizeDailyMeta(localIn.meta), normalizeDailyProgressMap(localIn.progress));
  const cm = migrateDailyState(normalizeDailyMeta(cloudIn.meta), normalizeDailyProgressMap(cloudIn.progress));
  const local = { meta: lm.meta, progress: lm.progress };
  const cloud = { meta: cm.meta, progress: cm.progress };

  const progress: Record<string, DailyProgress> = {};
  for (const key of new Set([...Object.keys(local.progress), ...Object.keys(cloud.progress)])) {
    const a = local.progress[key] ?? {};
    const b = cloud.progress[key] ?? {};
    const entry: DailyProgress = {};
    if (a.leagueLeaders || b.leagueLeaders) entry.leagueLeaders = true;
    if (a.playoffTitle || b.playoffTitle) entry.playoffTitle = true;
    if (isFinishedDay(a) || isFinishedDay(b)) entry.finished = true;
    if (a.frozen || b.frozen) entry.frozen = true;
    if (a.perfect || b.perfect) entry.perfect = true;
    const result = mergeResult(a.result, b.result);
    if (result) entry.result = result;
    progress[key] = entry;
  }

  const localLast = local.meta.lastCompletedDateKey;
  const cloudLast = cloud.meta.lastCompletedDateKey;
  let winner: DailyChallengeMeta;
  if (localLast && cloudLast) {
    if (cloudLast > localLast) winner = cloud.meta;
    else if (localLast > cloudLast) winner = local.meta;
    else {
      winner = {
        ...local.meta,
        currentStreak: Math.max(local.meta.currentStreak, cloud.meta.currentStreak),
        freezes: Math.max(local.meta.freezes ?? 0, cloud.meta.freezes ?? 0),
        celebratedMilestone: Math.max(local.meta.celebratedMilestone ?? 0, cloud.meta.celebratedMilestone ?? 0),
        freezeEarnedAt: Math.max(local.meta.freezeEarnedAt ?? 0, cloud.meta.freezeEarnedAt ?? 0),
      };
    }
  } else if (cloudLast) {
    winner = cloud.meta;
  } else {
    winner = local.meta;
  }
  const lastCompletedDateKey = winner.lastCompletedDateKey;
  const baseStreak = winner.currentStreak;

  // Recompute continuity: finished days (from the unioned claims) ending on the latest covered
  // day. Claims are trimmed to the last 60 days, so never go below the streak the winning
  // device already recorded. A streak the winner had already broken (0) stays broken.
  let currentStreak = baseStreak;
  if (lastCompletedDateKey && baseStreak > 0) {
    let walked = countStreakFromProgress(progress, lastCompletedDateKey);
    if (walked === 0) walked = 1; // meta says it was completed even if the claim was trimmed
    currentStreak = Math.max(baseStreak, walked);
  } else if (!lastCompletedDateKey) {
    currentStreak = 0;
  }

  const bestStreak = Math.max(local.meta.bestStreak, cloud.meta.bestStreak, currentStreak);
  const perfectDays = Math.max(
    local.meta.perfectDays ?? 0,
    cloud.meta.perfectDays ?? 0,
    Object.values(progress).filter((p) => p.perfect).length
  );

  const cloudAttemptToday =
    cloudIn.attempt && cloudIn.attempt.date === todayKey ? cloudIn.attempt : null;
  const localAttemptToday =
    localIn.attempt && localIn.attempt.date === todayKey ? localIn.attempt : null;
  const attempt = cloudAttemptToday ?? localAttemptToday ?? null;

  return {
    meta: {
      ...winner,
      currentStreak,
      bestStreak,
      lastCompletedDateKey,
      perfectDays,
      freezes: Math.min(DAILY_MAX_FREEZES, winner.freezes ?? 0),
      rulesVersion: DAILY_STREAK_RULES_VERSION,
    },
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
