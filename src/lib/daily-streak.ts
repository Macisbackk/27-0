/**
 * Daily Challenge streak rules (v1.18). Pure functions over the stored meta + per-day progress,
 * shared by lib/daily-challenge.ts (device state) and storage/daily-challenge-cloud.ts (merge).
 *
 * - The streak counts days you FINISH the Daily (the counted attempt's regular season), not days
 *   you win it. Before v1.18 a day only counted with League Leaders + Grand Final, so almost
 *   every streak broke on day one.
 * - A "perfect day" (top of the table + Grand Final) is counted separately (meta.perfectDays).
 * - Streak freezes: one is earned at every 7-day milestone (7, 14, 21, …), or bought for Club
 *   Funds (buyStreakFreeze in daily-challenge.ts); at most DAILY_MAX_FREEZES held. A missed day
 *   uses one up automatically; a gap longer than your freezes cover breaks the streak.
 * - Milestones 3 / 7 / 30 / 100 are celebrated once per streak.
 * - The day's Daily score (the board ranking) uses the Weekly formula: 10 a regular-season win,
 *   +50 League Leaders, 15 a play-off win, +100 Grand Final. Max 450 (leaders get a bye).
 */

export const DAILY_STREAK_RULES_VERSION = 2;
export const DAILY_STREAK_MILESTONES = [3, 7, 30, 100] as const;
export const DAILY_FREEZE_EVERY = 7;
export const DAILY_MAX_FREEZES = 2;
export const DAILY_FREEZE_PRICE = 75_000;

export const DAILY_SCORE = {
  regularWin: 10,
  playoffWin: 15,
  grandFinal: 100,
  leagueLeaders: 50,
} as const;
/** Best possible day: 27-0, League Leaders (bye to the semi), 2 play-off wins and the Grand Final. */
export const DAILY_MAX_SCORE =
  27 * DAILY_SCORE.regularWin + DAILY_SCORE.leagueLeaders + 2 * DAILY_SCORE.playoffWin + DAILY_SCORE.grandFinal;

export interface DailyChallengeMeta {
  currentStreak: number;
  bestStreak: number;
  /** Last day the streak covers: a finished Daily, or a missed day bridged by a freeze. */
  lastCompletedDateKey: string | null;
  /** Days with League Leaders + Grand Final. */
  perfectDays?: number;
  /** Streak freezes held (0..DAILY_MAX_FREEZES). */
  freezes?: number;
  /** Highest milestone already celebrated for the current streak. */
  celebratedMilestone?: number;
  /** Streak length at which a freeze was last earned (one per 7-day milestone). */
  freezeEarnedAt?: number;
  rulesVersion?: number;
}

/** The counted attempt's result for a day. */
export interface DailyDayResult {
  runId: string;
  regularWins: number;
  leaguePosition: number;
  playoffWins: number;
  grandFinal: boolean;
  /** true once the play-offs are done (or missed). */
  final: boolean;
}

export interface DailyProgress {
  /** League Leaders bonus claimed (set by the game board). */
  leagueLeaders?: boolean;
  /** Grand Final bonus claimed (set by the game board). */
  playoffTitle?: boolean;
  /** Counted attempt finished its season: the day counts for the streak. */
  finished?: boolean;
  /** Missed day bridged by a streak freeze. */
  frozen?: boolean;
  /** Counted in meta.perfectDays. */
  perfect?: boolean;
  result?: DailyDayResult;
}

export const DEFAULT_DAILY_META: DailyChallengeMeta = {
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedDateKey: null,
  perfectDays: 0,
  freezes: 0,
  celebratedMilestone: 0,
  freezeEarnedAt: 0,
  rulesVersion: DAILY_STREAK_RULES_VERSION,
};

const nonNeg = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

export function normalizeDailyMeta(raw: unknown): DailyChallengeMeta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Partial<DailyChallengeMeta>;
  return {
    currentStreak: nonNeg(m.currentStreak),
    bestStreak: nonNeg(m.bestStreak),
    lastCompletedDateKey:
      typeof m.lastCompletedDateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.lastCompletedDateKey)
        ? m.lastCompletedDateKey
        : null,
    perfectDays: nonNeg(m.perfectDays),
    freezes: Math.min(DAILY_MAX_FREEZES, nonNeg(m.freezes)),
    celebratedMilestone: nonNeg(m.celebratedMilestone),
    freezeEarnedAt: nonNeg(m.freezeEarnedAt),
    rulesVersion: nonNeg(m.rulesVersion),
  };
}

function normalizeResult(raw: unknown): DailyDayResult | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<DailyDayResult>;
  if (typeof r.runId !== "string") return undefined;
  return {
    runId: r.runId,
    regularWins: Math.min(27, nonNeg(r.regularWins)),
    leaguePosition: Math.max(1, nonNeg(r.leaguePosition) || 99),
    playoffWins: Math.min(3, nonNeg(r.playoffWins)),
    grandFinal: r.grandFinal === true,
    final: r.final === true,
  };
}

export function normalizeDailyProgressEntry(raw: unknown): DailyProgress {
  const p = (raw && typeof raw === "object" ? raw : {}) as DailyProgress;
  const out: DailyProgress = {};
  if (p.leagueLeaders) out.leagueLeaders = true;
  if (p.playoffTitle) out.playoffTitle = true;
  if (p.finished) out.finished = true;
  if (p.frozen) out.frozen = true;
  if (p.perfect) out.perfect = true;
  const result = normalizeResult(p.result);
  if (result) out.result = result;
  return out;
}

export function normalizeDailyProgressMap(raw: unknown): Record<string, DailyProgress> {
  const out: Record<string, DailyProgress> = {};
  if (Array.isArray(raw)) {
    // Oldest format: a list of fully claimed days.
    for (const key of raw) {
      if (typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
        out[key] = { leagueLeaders: true, playoffTitle: true };
      }
    }
    return out;
  }
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    out[key] = normalizeDailyProgressEntry(value);
  }
  return out;
}

/** YYYY-MM-DD plus `n` calendar days. */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() + n);
  return utc.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const toDay = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
  };
  return toDay(b) - toDay(a);
}

/** The season was finished that day (any format, including pre-v1.18 bonus flags). */
export function isFinishedDay(p: DailyProgress | undefined): boolean {
  return Boolean(p && (p.finished || p.leagueLeaders || p.playoffTitle || p.result));
}

export function isPerfectProgress(p: DailyProgress | undefined): boolean {
  if (!p) return false;
  if (p.leagueLeaders && p.playoffTitle) return true;
  return Boolean(p.result && p.result.leaguePosition === 1 && p.result.grandFinal);
}

export function computeDailyScore(r: Pick<DailyDayResult, "regularWins" | "leaguePosition" | "playoffWins" | "grandFinal">): number {
  const regularWins = Math.min(27, nonNeg(r.regularWins));
  const playoffWins = Math.min(3, nonNeg(r.playoffWins));
  return (
    regularWins * DAILY_SCORE.regularWin +
    (r.leaguePosition === 1 ? DAILY_SCORE.leagueLeaders : 0) +
    playoffWins * DAILY_SCORE.playoffWin +
    (r.grandFinal ? DAILY_SCORE.grandFinal : 0)
  );
}

/**
 * Consecutive finished days ending on `endKey`, walking back through the progress map. Frozen
 * days bridge the gap without adding to the count.
 */
export function countStreakFromProgress(progress: Record<string, DailyProgress>, endKey: string): number {
  let count = 0;
  let key = endKey;
  for (let i = 0; i < 400; i += 1) {
    const p = progress[key];
    if (isFinishedDay(p)) count += 1;
    else if (!p?.frozen) break;
    key = addDaysToKey(key, -1);
  }
  return count;
}

export interface SettleResult {
  meta: DailyChallengeMeta;
  progress: Record<string, DailyProgress>;
  /** Freezes used just now. */
  consumed: number;
  /** The streak broke just now. */
  broken: boolean;
}

/**
 * Apply missed days up to (not including) `todayKey`. Each missed day since the last covered day
 * uses a freeze; if there aren't enough, the streak resets to 0 and the freezes are kept.
 */
export function settleMissedDays(
  metaIn: DailyChallengeMeta,
  progressIn: Record<string, DailyProgress>,
  todayKey: string
): SettleResult {
  const meta = { ...metaIn };
  const progress = { ...progressIn };
  const last = meta.lastCompletedDateKey;
  if (!last || meta.currentStreak <= 0) return { meta, progress, consumed: 0, broken: false };
  const missed = daysBetweenKeys(last, todayKey) - 1;
  if (missed <= 0) return { meta, progress, consumed: 0, broken: false };
  const freezes = meta.freezes ?? 0;
  if (missed <= freezes) {
    for (let i = 1; i <= missed; i += 1) {
      const key = addDaysToKey(last, i);
      progress[key] = { ...progress[key], frozen: true };
    }
    meta.freezes = freezes - missed;
    meta.lastCompletedDateKey = addDaysToKey(todayKey, -1);
    return { meta, progress, consumed: missed, broken: false };
  }
  meta.currentStreak = 0;
  meta.celebratedMilestone = 0;
  meta.freezeEarnedAt = 0;
  return { meta, progress, consumed: 0, broken: true };
}

export interface FinishResult {
  meta: DailyChallengeMeta;
  progress: Record<string, DailyProgress>;
  /** false when the day was already counted. */
  counted: boolean;
  freezeEarned: boolean;
}

/** Count `todayKey` as a finished Daily: settle missed days, then extend (or start) the streak. */
export function applyDailyFinish(
  metaIn: DailyChallengeMeta,
  progressIn: Record<string, DailyProgress>,
  todayKey: string
): FinishResult {
  const settled = settleMissedDays(metaIn, progressIn, todayKey);
  const meta = settled.meta;
  const progress = settled.progress;
  progress[todayKey] = { ...progress[todayKey], finished: true };
  if (meta.lastCompletedDateKey === todayKey && meta.currentStreak > 0) {
    return { meta, progress, counted: false, freezeEarned: false };
  }
  const continues =
    meta.currentStreak > 0 &&
    meta.lastCompletedDateKey !== null &&
    daysBetweenKeys(meta.lastCompletedDateKey, todayKey) === 1;
  meta.currentStreak = continues ? meta.currentStreak + 1 : 1;
  if (!continues) {
    meta.celebratedMilestone = 0;
    meta.freezeEarnedAt = 0;
  }
  meta.bestStreak = Math.max(meta.bestStreak, meta.currentStreak);
  meta.lastCompletedDateKey = todayKey;
  let freezeEarned = false;
  if (
    meta.currentStreak % DAILY_FREEZE_EVERY === 0 &&
    (meta.freezeEarnedAt ?? 0) < meta.currentStreak &&
    (meta.freezes ?? 0) < DAILY_MAX_FREEZES
  ) {
    meta.freezes = (meta.freezes ?? 0) + 1;
    freezeEarned = true;
  }
  if (meta.currentStreak % DAILY_FREEZE_EVERY === 0) meta.freezeEarnedAt = meta.currentStreak;
  return { meta, progress, counted: true, freezeEarned };
}

/** Count a perfect day once. */
export function applyPerfectDay(
  metaIn: DailyChallengeMeta,
  progressIn: Record<string, DailyProgress>,
  key: string
): { meta: DailyChallengeMeta; progress: Record<string, DailyProgress>; counted: boolean } {
  const p = progressIn[key];
  if (!isPerfectProgress(p) || p?.perfect) return { meta: metaIn, progress: progressIn, counted: false };
  return {
    meta: { ...metaIn, perfectDays: (metaIn.perfectDays ?? 0) + 1 },
    progress: { ...progressIn, [key]: { ...p, perfect: true } },
    counted: true,
  };
}

/** The milestone reached by the current streak that hasn't been celebrated yet, if any. */
export function pendingStreakMilestone(meta: DailyChallengeMeta): number | null {
  const reached = [...DAILY_STREAK_MILESTONES].reverse().find((m) => meta.currentStreak >= m);
  if (!reached) return null;
  return reached > (meta.celebratedMilestone ?? 0) && meta.currentStreak === reached ? reached : null;
}

/** Next milestone above the current streak (null past 100). */
export function nextStreakMilestone(streak: number): number | null {
  return DAILY_STREAK_MILESTONES.find((m) => m > streak) ?? null;
}

/**
 * One-off upgrade of pre-v1.18 data. Nobody loses their streak: the stored streak (earned under
 * the stricter "win the day" rule) is kept, and may grow when the claim map shows more
 * consecutive finished days (any day with a League Leaders claim was a finished season).
 * Perfect days are counted from the claims still on the device (last 60 days).
 */
export function migrateDailyState(
  metaIn: DailyChallengeMeta,
  progressIn: Record<string, DailyProgress>
): { meta: DailyChallengeMeta; progress: Record<string, DailyProgress>; changed: boolean } {
  if ((metaIn.rulesVersion ?? 0) >= DAILY_STREAK_RULES_VERSION) {
    return { meta: metaIn, progress: progressIn, changed: false };
  }
  const meta: DailyChallengeMeta = { ...DEFAULT_DAILY_META, ...metaIn };
  const progress: Record<string, DailyProgress> = {};
  let perfect = 0;
  for (const [key, value] of Object.entries(progressIn)) {
    const entry = { ...value };
    if (isFinishedDay(entry)) entry.finished = true;
    if (isPerfectProgress(entry)) {
      entry.perfect = true;
      perfect += 1;
    }
    progress[key] = entry;
  }
  const finishedKeys = Object.keys(progress).filter((k) => progress[k]!.finished).sort();
  const latest = finishedKeys[finishedKeys.length - 1] ?? null;
  if (latest && (!meta.lastCompletedDateKey || latest >= meta.lastCompletedDateKey)) {
    const walked = countStreakFromProgress(progress, latest);
    if (latest === meta.lastCompletedDateKey) {
      meta.currentStreak = Math.max(meta.currentStreak, walked);
    } else {
      // A later finished day than the old meta knew about (e.g. top of the table, lost the GF).
      const old = meta.lastCompletedDateKey;
      let joined = Boolean(old && meta.currentStreak > 0);
      if (old && joined) {
        for (let k = addDaysToKey(old, 1); k <= latest; k = addDaysToKey(k, 1)) {
          if (!isFinishedDay(progress[k])) {
            joined = false;
            break;
          }
        }
      }
      meta.currentStreak = joined && old
        ? Math.max(walked, meta.currentStreak + daysBetweenKeys(old, latest))
        : walked;
      meta.lastCompletedDateKey = latest;
    }
  }
  meta.bestStreak = Math.max(meta.bestStreak, meta.currentStreak);
  meta.perfectDays = Math.max(meta.perfectDays ?? 0, perfect);
  // Milestones already passed don't pop up again; freezes start from the next 7-day milestone.
  meta.celebratedMilestone = [...DAILY_STREAK_MILESTONES].reverse().find((m) => meta.currentStreak >= m) ?? 0;
  meta.freezeEarnedAt = Math.floor(meta.currentStreak / DAILY_FREEZE_EVERY) * DAILY_FREEZE_EVERY;
  meta.freezes = meta.freezes ?? 0;
  meta.rulesVersion = DAILY_STREAK_RULES_VERSION;
  return { meta, progress, changed: true };
}
