import {
  buildDailyRuleScenario,
  DAILY_RULE_TYPES,
  getDailyChallengeDateKey,
  getDailyChallengeScenario,
  type DailyChallengeRule,
  type DailyChallengeScenario,
} from "./daily-challenge";
import { STORAGE_KEYS } from "./storage/keys";

/**
 * Weekly Challenge — one seeded challenge for the whole UK week (Monday 00:00 to Sunday 23:59
 * Europe/London). Everyone gets the same rule twist and the same spins (shared seed), and each
 * coach gets ONE ranked attempt a week: the first Weekly run started that week. Later runs that
 * week are practice. Reuses the Daily rule pool and spin filters; what's new is the week key,
 * the score, the per-week board (storage/weekly-leaderboard.ts, table weekly_challenge_entries)
 * and a Club Funds reward for finishing in the week's top 10.
 *
 * This module stays free of the Supabase client (it's imported by the home card and nav).
 */

export type WeeklyChallengeScenario = DailyChallengeScenario;

/** Points per outcome. Score = regular wins ×10 + play-off wins ×15 + Grand Final + League Leaders. */
export const WEEKLY_SCORE = {
  regularWin: 10,
  playoffWin: 15,
  grandFinal: 100,
  leagueLeaders: 50,
} as const;

/** 27 league rounds, at most 3 play-off wins (elimination, semi, Grand Final). */
export const WEEKLY_MAX_REGULAR_WINS = 27;
export const WEEKLY_MAX_PLAYOFF_WINS = 3;

/** Theoretical maximum: 27 regular wins, 3 play-off wins, Grand Final and League Leaders. */
export const WEEKLY_MAX_SCORE =
  WEEKLY_MAX_REGULAR_WINS * WEEKLY_SCORE.regularWin +
  WEEKLY_MAX_PLAYOFF_WINS * WEEKLY_SCORE.playoffWin +
  WEEKLY_SCORE.grandFinal +
  WEEKLY_SCORE.leagueLeaders;

/** Finishing in the top 10 of a week's final board pays this once, after the week ends. */
export const WEEKLY_TOP10_REWARD = 150_000;
export const WEEKLY_TOP10_RANK = 10;

export interface WeeklyScoreInput {
  regularWins: number;
  playoffWins: number;
  grandFinalWon: boolean;
  leagueLeaders: boolean;
}

/** Clamp a breakdown to what a real run can produce (also what the DB checks accept). */
export function normalizeWeeklyScoreInput(input: WeeklyScoreInput): WeeklyScoreInput {
  const clamp = (n: number, max: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
  const playoffWins = clamp(input.playoffWins, WEEKLY_MAX_PLAYOFF_WINS);
  return {
    regularWins: clamp(input.regularWins, WEEKLY_MAX_REGULAR_WINS),
    playoffWins,
    // You can't win the Grand Final without winning a play-off game.
    grandFinalWon: input.grandFinalWon === true && playoffWins >= 1,
    leagueLeaders: input.leagueLeaders === true,
  };
}

export function computeWeeklyChallengeScore(input: WeeklyScoreInput): number {
  const n = normalizeWeeklyScoreInput(input);
  return (
    n.regularWins * WEEKLY_SCORE.regularWin +
    n.playoffWins * WEEKLY_SCORE.playoffWin +
    (n.grandFinalWon ? WEEKLY_SCORE.grandFinal : 0) +
    (n.leagueLeaders ? WEEKLY_SCORE.leagueLeaders : 0)
  );
}

// ---------------------------------------------------------------------------
// Week keys (UK calendar, ISO weeks: Monday to Sunday)
// ---------------------------------------------------------------------------

/** Whole days since 1970-01-01 for a YYYY-MM-DD key (calendar maths, no time zone). */
function dayIndexForKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

function keyForDayIndex(dayIndex: number): string {
  return new Date(dayIndex * 86_400_000).toISOString().slice(0, 10);
}

/** 1970-01-01 was a Thursday; shifting by 3 makes week boundaries fall on Monday 00:00. */
function weekIndexForDayIndex(dayIndex: number): number {
  return Math.floor((dayIndex + 3) / 7);
}

/** Monday of the week that contains `dayIndex`. */
function mondayDayIndex(dayIndex: number): number {
  return weekIndexForDayIndex(dayIndex) * 7 - 3;
}

/** ISO-8601 week key ("2026-W43") for a YYYY-MM-DD key. */
function isoWeekKeyForDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  // ISO weeks belong to the year that holds their Thursday.
  const dayOfWeek = date.getUTCDay() || 7; // Mon 1 … Sun 7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Monday (YYYY-MM-DD) of an ISO week key such as "2026-W43". */
export function getWeekMondayDateKey(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) throw new Error(`Bad week key: ${weekKey}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  // 4 January is always in ISO week 1.
  const jan4 = Math.floor(Date.UTC(year, 0, 4) / 86_400_000);
  return keyForDayIndex(mondayDayIndex(jan4) + (week - 1) * 7);
}

/** This UK week's key, e.g. "2026-W43". Same for everyone from Monday 00:00 to Sunday 23:59 UK. */
export function getWeeklyChallengeWeekKey(date = new Date()): string {
  return isoWeekKeyForDateKey(getDailyChallengeDateKey(date));
}

/** Key of the week before the one containing `date`. */
export function getPreviousWeeklyChallengeWeekKey(date = new Date()): string {
  const monday = mondayDayIndex(dayIndexForKey(getDailyChallengeDateKey(date)));
  return isoWeekKeyForDateKey(keyForDayIndex(monday - 7));
}

/** The seven UK date keys (Mon–Sun) of the week containing `date`. */
export function getWeeklyChallengeDateKeys(date = new Date()): string[] {
  const monday = mondayDayIndex(dayIndexForKey(getDailyChallengeDateKey(date)));
  return Array.from({ length: 7 }, (_, i) => keyForDayIndex(monday + i));
}

/** Minutes that Europe/London is ahead of UTC at `date` (0 or 60). */
function londonOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Instant (UTC ms) of the next Monday 00:00 in the UK after `date`. */
export function getWeeklyChallengeResetTime(date = new Date()): number {
  const todayIndex = dayIndexForKey(getDailyChallengeDateKey(date));
  const nextMonday = mondayDayIndex(todayIndex) + 7;
  const wallClock = nextMonday * 86_400_000; // Monday 00:00 as if the UK were on UTC
  // Two passes handle a DST change between now and the reset.
  let instant = wallClock - londonOffsetMinutes(new Date(wallClock)) * 60_000;
  instant = wallClock - londonOffsetMinutes(new Date(instant)) * 60_000;
  return instant;
}

/** "3d 4h", "6h", "under an hour" — for the home card's "Resets in …". */
export function formatWeeklyResetCountdown(date = new Date()): string {
  const ms = Math.max(0, getWeeklyChallengeResetTime(date) - date.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours - days * 24}h`;
  if (hours > 0) return `${hours}h`;
  return "under an hour";
}

// ---------------------------------------------------------------------------
// The week's rule
// ---------------------------------------------------------------------------

const WEEKLY_SALT = "27-0-weekly-v1";

function hashString(value: string): number {
  const seeded = `${WEEKLY_SALT}:${value}`;
  let h = 2166136261;
  for (let i = 0; i < seeded.length; i++) {
    h ^= seeded.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Two rules are the same when type and parameters match (Current vs Era doesn't matter). */
function sameRule(a: DailyChallengeRule, b: DailyChallengeRule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const MAX_CANDIDATE_STEPS = 64;

/**
 * The week's rule: seeded from the week key so everyone gets the same one, and never the same
 * rule as any Daily that week (today's included). Candidates step through the rule types from a
 * hashed start; each lap bumps the parameter block so the same type comes back with a different
 * club / decade / cap. Deterministic for the whole UK week.
 */
export function getWeeklyChallengeScenario(date = new Date()): WeeklyChallengeScenario {
  const dateKeys = getWeeklyChallengeDateKeys(date);
  const weekKey = isoWeekKeyForDateKey(dateKeys[0]!);
  const weekIndex = weekIndexForDayIndex(dayIndexForKey(dateKeys[0]!));
  const dailyRules = dateKeys.map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    // Noon UTC is always inside that UK calendar day.
    return getDailyChallengeScenario(new Date(Date.UTC(y!, m! - 1, d!, 12))).rule;
  });

  const n = DAILY_RULE_TYPES.length;
  const start = hashString(weekKey) % n;
  let candidate: WeeklyChallengeScenario | null = null;
  for (let step = 0; step < MAX_CANDIDATE_STEPS; step += 1) {
    const type = DAILY_RULE_TYPES[(start + step) % n]!;
    const block = weekIndex + Math.floor(step / n);
    candidate = buildDailyRuleScenario(type, block);
    const rule = candidate.rule;
    if (!dailyRules.some((daily) => sameRule(daily, rule))) return candidate;
  }
  // Unreachable in practice (18 distinct rules vs at most 7 Dailies); scripts/test-weekly.ts checks.
  return candidate!;
}

export function getWeeklyChallengeHref(date = new Date()): string {
  const scenario = getWeeklyChallengeScenario(date);
  return scenario.eraMode ? "/play?weekly=1&era=1" : "/play?weekly=1";
}

export function isWeeklyChallengeActive(search: { weekly?: string | null }): boolean {
  return search.weekly === "1";
}

/** Shared spin seed for the week: everyone (and every practice run) gets the same spins. */
export function getWeeklyChallengeSeed(date = new Date()): string {
  return `weekly-${getWeeklyChallengeWeekKey(date)}`;
}

/** Run ids for Weekly runs: `run-weekly-<weekKey>-<unique>`. */
export function getWeeklyChallengeRunIdPrefix(date = new Date()): string {
  return `run-weekly-${getWeeklyChallengeWeekKey(date)}`;
}

// ---------------------------------------------------------------------------
// Board ranking + the top-10 reward (pure — shared by the board and scripts/test-weekly.ts)
// ---------------------------------------------------------------------------

export interface WeeklyBoardEntry {
  userId?: string;
  username: string;
  score: number;
  /** ISO timestamp of the entry (server `created_at`): earlier wins ties. */
  createdAt: string;
}

export interface WeeklyRankedEntry extends WeeklyBoardEntry {
  rank: number;
  topTen: boolean;
}

/**
 * Board order: highest score first, earlier entry first on a tie, then name so the order is
 * total. One row per coach (best kept if a coach somehow appears twice). Ranks are positions,
 * so exactly WEEKLY_TOP10_RANK coaches are ever "top 10".
 */
export function rankWeeklyEntries(entries: readonly WeeklyBoardEntry[]): WeeklyRankedEntry[] {
  const byCoach = new Map<string, WeeklyBoardEntry>();
  for (const entry of entries) {
    if (!entry.username || !(entry.score > 0)) continue;
    const key = entry.userId ?? entry.username.toLowerCase();
    const existing = byCoach.get(key);
    if (
      !existing ||
      entry.score > existing.score ||
      (entry.score === existing.score && entry.createdAt < existing.createdAt)
    ) {
      byCoach.set(key, entry);
    }
  }
  return [...byCoach.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.username.localeCompare(b.username)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1, topTen: index < WEEKLY_TOP10_RANK }));
}

/** Club Funds owed for a finishing rank (null = not on the board). */
export function getWeeklyTop10Reward(rank: number | null): number {
  return rank !== null && rank >= 1 && rank <= WEEKLY_TOP10_RANK ? WEEKLY_TOP10_REWARD : 0;
}

/**
 * Ledger id for a week's top-10 payout. It carries the week's Monday date so the Club Funds
 * ledger keeps it for 45 days (trimPaidRunIds keeps dated ids by age, undated ones by count),
 * well past the one week in which the payout can be claimed.
 */
export function getWeeklyTop10RunId(weekKey: string): string {
  return `weekly-top10-${weekKey}-${getWeekMondayDateKey(weekKey)}`;
}

/**
 * May the payout for `weekKey` be claimed at `now`? Only once the week is over (its board is
 * final: the DB refuses writes to a closed week) and only for the week just gone, so a stale
 * or tampered cache can't reach back for older weeks.
 */
export function canClaimWeeklyTop10(weekKey: string, now = new Date()): boolean {
  return weekKey === getPreviousWeeklyChallengeWeekKey(now);
}

// ---------------------------------------------------------------------------
// On-device state: this week's ranked attempt + last week's finish
// ---------------------------------------------------------------------------

export interface WeeklyChallengeEntry {
  weekKey: string;
  /** The run that holds the week's ranked attempt. */
  runId: string;
  input: WeeklyScoreInput;
  score: number;
  /** false while the play-offs are still to come for this run. */
  final: boolean;
  /** Which version of the entry the board has: none yet, the regular season, or the final. */
  synced: "none" | "regular" | "final";
  /** The board refused the entry (e.g. this coach already has one from another device). */
  rejected?: boolean;
}

export interface WeeklyChallengeState {
  /** This week's ranked attempt (claimed when the run starts). */
  attempt: { weekKey: string; runId: string } | null;
  /** Score of the ranked attempt, once it has one. */
  entry: WeeklyChallengeEntry | null;
  /** Last completed week's finish, once read from its final board. */
  lastWeek: { weekKey: string; rank: number | null; paid: boolean } | null;
}

const DEFAULT_STATE: WeeklyChallengeState = { attempt: null, entry: null, lastWeek: null };

function parseInput(raw: unknown): WeeklyScoreInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return normalizeWeeklyScoreInput({
    regularWins: typeof r.regularWins === "number" ? r.regularWins : 0,
    playoffWins: typeof r.playoffWins === "number" ? r.playoffWins : 0,
    grandFinalWon: r.grandFinalWon === true,
    leagueLeaders: r.leagueLeaders === true,
  });
}

export function parseWeeklyChallengeState(raw: string | null): WeeklyChallengeState {
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const a = parsed.attempt as Record<string, unknown> | null | undefined;
    const attempt =
      a && typeof a.weekKey === "string" && typeof a.runId === "string"
        ? { weekKey: a.weekKey, runId: a.runId }
        : null;
    const e = parsed.entry as Record<string, unknown> | null | undefined;
    const input = e ? parseInput(e.input) : null;
    const entry: WeeklyChallengeEntry | null =
      e && input && typeof e.weekKey === "string" && typeof e.runId === "string"
        ? {
            weekKey: e.weekKey,
            runId: e.runId,
            input,
            score: computeWeeklyChallengeScore(input),
            final: e.final === true,
            synced: e.synced === "regular" || e.synced === "final" ? e.synced : "none",
            ...(e.rejected === true ? { rejected: true } : {}),
          }
        : null;
    const l = parsed.lastWeek as Record<string, unknown> | null | undefined;
    const lastWeek =
      l && typeof l.weekKey === "string"
        ? {
            weekKey: l.weekKey,
            rank: typeof l.rank === "number" && l.rank > 0 ? Math.floor(l.rank) : null,
            paid: l.paid === true,
          }
        : null;
    return { attempt, entry, lastWeek };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function loadWeeklyChallengeState(): WeeklyChallengeState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    return parseWeeklyChallengeState(localStorage.getItem(STORAGE_KEYS.weeklyChallenge));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveWeeklyChallengeState(state: WeeklyChallengeState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.weeklyChallenge, JSON.stringify(state));
  } catch {
    // storage unavailable
  }
}

function updateWeeklyChallengeState(
  change: (state: WeeklyChallengeState) => WeeklyChallengeState
): WeeklyChallengeState {
  const next = change(loadWeeklyChallengeState());
  saveWeeklyChallengeState(next);
  return next;
}

/**
 * One ranked Weekly attempt per UK week. The first Weekly run started this week claims it;
 * later runs (Leave run, reload, Play again) are practice. Idempotent for the same runId.
 */
export function claimWeeklyChallengeAttempt(runId: string, date = new Date()): boolean {
  if (typeof window === "undefined") return true;
  const weekKey = getWeeklyChallengeWeekKey(date);
  const state = loadWeeklyChallengeState();
  if (state.attempt && state.attempt.weekKey === weekKey) return state.attempt.runId === runId;
  saveWeeklyChallengeState({
    ...state,
    attempt: { weekKey, runId },
    // A new week starts clean; last week's entry is on (and final on) the board.
    entry: state.entry && state.entry.weekKey === weekKey ? state.entry : null,
  });
  return true;
}

/** True when this week's ranked attempt has already been started (read-only). */
export function getWeeklyChallengeAttemptUsed(date = new Date()): boolean {
  const state = loadWeeklyChallengeState();
  return Boolean(state.attempt && state.attempt.weekKey === getWeeklyChallengeWeekKey(date));
}

/** This week's ranked entry on this device, if the attempt has a score yet. */
export function getWeeklyChallengeEntry(date = new Date()): WeeklyChallengeEntry | null {
  const entry = loadWeeklyChallengeState().entry;
  return entry && entry.weekKey === getWeeklyChallengeWeekKey(date) ? entry : null;
}

/**
 * Store the ranked attempt's score. `final` is false after a regular season that reached the
 * play-offs (the play-off result is added later, once). Ignores runs that aren't the week's
 * ranked attempt, and never lets a final entry change. Returns the stored entry, or null.
 */
export function recordWeeklyChallengeEntry(
  runId: string,
  input: WeeklyScoreInput,
  final: boolean,
  date = new Date()
): WeeklyChallengeEntry | null {
  const weekKey = getWeeklyChallengeWeekKey(date);
  const state = loadWeeklyChallengeState();
  if (!state.attempt || state.attempt.weekKey !== weekKey || state.attempt.runId !== runId) {
    return null;
  }
  const existing = state.entry && state.entry.weekKey === weekKey ? state.entry : null;
  if (existing && (existing.runId !== runId || existing.final)) return existing;
  const normalized = normalizeWeeklyScoreInput(
    existing
      ? // The regular season is fixed once recorded; only the play-off part is added.
        { ...input, regularWins: existing.input.regularWins, leagueLeaders: existing.input.leagueLeaders }
      : input
  );
  const entry: WeeklyChallengeEntry = {
    weekKey,
    runId,
    input: normalized,
    score: computeWeeklyChallengeScore(normalized),
    final,
    synced: existing?.synced ?? "none",
  };
  saveWeeklyChallengeState({ ...state, entry });
  return entry;
}

/** Mark how far the board has caught up with the device's entry (storage/weekly-leaderboard.ts). */
export function markWeeklyChallengeEntrySynced(
  weekKey: string,
  runId: string,
  synced: "regular" | "final",
  rejected = false
): void {
  updateWeeklyChallengeState((state) =>
    state.entry && state.entry.weekKey === weekKey && state.entry.runId === runId
      ? { ...state, entry: { ...state.entry, synced, ...(rejected ? { rejected: true } : {}) } }
      : state
  );
}

/** Remember last week's finish (and whether its reward is paid) so the board is read once. */
export function rememberWeeklyChallengeLastWeek(
  weekKey: string,
  rank: number | null,
  paid: boolean
): void {
  updateWeeklyChallengeState((state) => ({ ...state, lastWeek: { weekKey, rank, paid } }));
}

/**
 * Score a finished stage of a Weekly run. For the ranked attempt, store it and (when signed in)
 * send it to the board; practice runs just get their score back. Lazy import keeps the
 * Supabase client out of this module.
 */
export function submitWeeklyChallengeRun(
  runId: string,
  input: WeeklyScoreInput,
  final: boolean,
  date = new Date()
): { score: number; ranked: boolean } {
  const entry = recordWeeklyChallengeEntry(runId, input, final, date);
  if (entry && entry.runId === runId && typeof window !== "undefined") {
    void import("./storage/weekly-leaderboard")
      .then(({ flushWeeklyChallengeEntry }) => flushWeeklyChallengeEntry())
      .catch(() => {
        /* offline / not configured: the board or home card retries */
      });
  }
  return {
    score: entry && entry.runId === runId ? entry.score : computeWeeklyChallengeScore(input),
    ranked: Boolean(entry && entry.runId === runId),
  };
}

/** "4th", "11th", "22nd" … */
export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
