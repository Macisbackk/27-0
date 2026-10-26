import { STORAGE_KEYS } from "./storage/keys";
import {
  applyDailyFinish,
  applyPerfectDay,
  computeDailyScore,
  DAILY_FREEZE_PRICE,
  DAILY_MAX_FREEZES,
  DEFAULT_DAILY_META,
  migrateDailyState,
  normalizeDailyMeta,
  normalizeDailyProgressMap,
  settleMissedDays,
  type DailyChallengeMeta,
  type DailyDayResult,
  type DailyProgress,
} from "./daily-streak";

export type { DailyChallengeMeta, DailyDayResult, DailyProgress } from "./daily-streak";

export const DAILY_CHALLENGE_MODE = "CLASSIC" as const;

const DEFAULT_META: DailyChallengeMeta = DEFAULT_DAILY_META;

/**
 * Daily rule types. Each day plays one, rotated so the same type never runs two days in a
 * row (see getDailyRuleType). Spin enforcement lives in lib/game/daily-rule-filter.ts.
 */
export const DAILY_RULE_TYPES = [
  "giant-killers",
  "one-club",
  "era-night",
  "underdogs",
  "no-respins",
  "homegrown",
  "overseas",
] as const;
export type DailyRuleType = (typeof DAILY_RULE_TYPES)[number];

export type DailyChallengeRule =
  /** Every league opponent is one of the strongest clubs. */
  | { type: "giant-killers"; club: string }
  /** Every spin lands on one club's history (Era pools, any year). */
  | { type: "one-club"; club: string }
  /** Every spin lands on a team-year inside the window. */
  | { type: "era-night"; fromYear: number; toYear: number; label: string }
  /** Only players rated `maxRating` or lower are offered. */
  | { type: "underdogs"; maxRating: number }
  /** Respins are disabled for the run. */
  | { type: "no-respins" }
  /** English, Welsh, Scottish and Irish players only. */
  | { type: "homegrown" }
  /** Players from outside Britain and Ireland only. */
  | { type: "overseas" };

export type DailyChallengeKind = string;

export interface DailyChallengeScenario {
  id: DailyChallengeKind;
  /** Same as ruleTitle — kept for Club Funds labels and older callers. */
  title: string;
  /** Same as ruleSummary. */
  blurb: string;
  rule: DailyChallengeRule;
  ruleType: DailyRuleType;
  /** Short rule name for cards and banners (≤ 18 chars), e.g. "One club: Wigan". */
  ruleTitle: string;
  /** One-line explanation (≤ 60 chars). */
  ruleSummary: string;
  /** Force every league opponent to this club (Giant killers days only). */
  forceOpponentClub: string | null;
  /** Historic spin pool + Era sim when true. */
  eraMode: boolean;
  leagueLeadersBonus: number;
  playoffTitleBonus: number;
}

/** Nationalities that count as "Homegrown" (everything else known is "Overseas"). */
export const DAILY_HOMEGROWN_NATIONALITIES = [
  "England",
  "Wales",
  "Scotland",
  "Ireland",
] as const;

/**
 * Giant killers opponents: the four strongest current clubs by base strength
 * (lib/game/club-strength.ts). Listed here rather than computed so this module — imported by
 * the nav on every page — doesn't pull in the club catalogue; scripts/test-daily-rules.ts
 * fails if it drifts from the strength table.
 */
export const GIANT_KILLER_CLUBS: readonly string[] = [
  "Wigan Warriors",
  "St Helens",
  "Leeds Rhinos",
  "Warrington Wolves",
];

/**
 * One club days — Era clubs with enough team-years that all 13 slots fill under the rule
 * (checked for every day by scripts/test-daily-rules.ts). Short names keep titles ≤ 18 chars.
 */
const ONE_CLUB_OPTIONS: readonly { club: string; short: string }[] = [
  { club: "Bradford Bulls", short: "Bradford" },
  { club: "St Helens", short: "Saints" },
  { club: "Catalans Dragons", short: "Catalans" },
  { club: "Leeds Rhinos", short: "Leeds" },
  { club: "Wigan Warriors", short: "Wigan" },
  { club: "Hull FC", short: "Hull FC" },
  { club: "Salford Red Devils", short: "Salford" },
];

const ERA_NIGHT_OPTIONS: readonly { fromYear: number; toYear: number; label: string }[] = [
  { fromYear: 2000, toYear: 2009, label: "2000s" },
  { fromYear: 2010, toYear: 2019, label: "2010s" },
];

/**
 * Underdogs rating cap per spin pool. Tuned by simulation (best-of-3 picks, 25 seasons): these
 * caps give roughly a 45–50% chance to top the table and 20–35% to win the Grand Final, vs
 * ~90% / 50–80% in plain Classic. Lower caps (82 / 85) made the Daily near-unwinnable (≤ 12%).
 */
const UNDERDOG_MAX_RATING = { current: 85, era: 87 } as const;

/**
 * Daily bonuses per rule (paid on top of normal Classic Club Funds, first counted attempt only).
 * The two rules that make the season clearly harder (Giant killers, Underdogs) pay a little more.
 */
export const DAILY_RULE_BONUSES: Record<
  DailyRuleType,
  { leagueLeadersBonus: number; playoffTitleBonus: number }
> = {
  "giant-killers": { leagueLeadersBonus: 80_000, playoffTitleBonus: 160_000 },
  "one-club": { leagueLeadersBonus: 70_000, playoffTitleBonus: 140_000 },
  "era-night": { leagueLeadersBonus: 70_000, playoffTitleBonus: 140_000 },
  underdogs: { leagueLeadersBonus: 80_000, playoffTitleBonus: 160_000 },
  "no-respins": { leagueLeadersBonus: 70_000, playoffTitleBonus: 140_000 },
  homegrown: { leagueLeadersBonus: 70_000, playoffTitleBonus: 140_000 },
  overseas: { leagueLeadersBonus: 70_000, playoffTitleBonus: 140_000 },
};

/** Whether this rule turns respins off for the run. */
export function dailyRuleDisablesRespins(
  rule: DailyChallengeRule | null | undefined
): boolean {
  return rule?.type === "no-respins";
}

/** UK calendar day — matches Super League fixture day and avoids SSR/client TZ skew. */
function todayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function loadRawMeta(): DailyChallengeMeta {
  if (typeof window === "undefined") return { ...DEFAULT_META };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeMeta);
    if (!raw) return { ...DEFAULT_META };
    return normalizeDailyMeta(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_META };
  }
}

function writeState(meta: DailyChallengeMeta, progress?: Record<string, DailyProgress>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.dailyChallengeMeta, JSON.stringify(meta));
    if (progress) writeProgressMap(progress);
  } catch {
    // storage unavailable
  }
  scheduleCloudSave();
}

/**
 * Meta with the v1.18 migration and any missed days applied (a missed day uses a freeze). The
 * settled state is written back so every screen agrees.
 */
function loadMeta(date = new Date()): DailyChallengeMeta {
  if (typeof window === "undefined") return { ...DEFAULT_META };
  const raw = loadRawMeta();
  let progress = loadProgressMap();
  let meta = raw;
  let changed = false;
  const migrated = migrateDailyState(meta, progress);
  if (migrated.changed) {
    meta = migrated.meta;
    progress = migrated.progress;
    changed = true;
  }
  const settled = settleMissedDays(meta, progress, todayKey(date));
  if (settled.consumed > 0 || settled.broken) {
    meta = settled.meta;
    progress = settled.progress;
    changed = true;
  }
  if (changed) writeState(meta, progress);
  return meta;
}

/**
 * Queue a cloud backup of the Daily state (signed-in players only; guests are a no-op inside
 * saveDailyCloud). Lazy import keeps this nav-wide module free of the Supabase client.
 */
function scheduleCloudSave(): void {
  if (typeof window === "undefined") return;
  void import("./storage/daily-challenge-cloud")
    .then(({ saveDailyCloud }) => saveDailyCloud())
    .catch(() => {
      /* offline / not configured: next change retries */
    });
}

export const DAILY_STREAK_CHANGED_EVENT = "27-0-daily-streak-changed";

function notifyStreakChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(DAILY_STREAK_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function getDailyChallengeMeta(): DailyChallengeMeta {
  return loadMeta();
}

export function getDailyChallengeStreak(): number {
  return loadMeta().currentStreak;
}

export function getDailyChallengeBestStreak(): number {
  return loadMeta().bestStreak;
}

export function getDailyPerfectDays(): number {
  return loadMeta().perfectDays ?? 0;
}

export function getDailyStreakFreezes(): number {
  return loadMeta().freezes ?? 0;
}

export { DAILY_FREEZE_PRICE, DAILY_MAX_FREEZES };

/**
 * Add one held streak freeze (capped at DAILY_MAX_FREEZES). Returns the new count, or null when
 * already at the cap. Payment lives in lib/streak-freeze.ts (buyStreakFreeze).
 */
export function addDailyStreakFreeze(date = new Date()): number | null {
  const meta = loadMeta(date);
  const held = meta.freezes ?? 0;
  if (held >= DAILY_MAX_FREEZES) return null;
  writeState({ ...meta, freezes: held + 1 });
  notifyStreakChanged();
  return held + 1;
}

/** Mark a streak milestone (3/7/30/100) as celebrated so it shows once. */
export function markDailyMilestoneCelebrated(milestone: number): void {
  const meta = loadMeta();
  if ((meta.celebratedMilestone ?? 0) >= milestone) return;
  writeState({ ...meta, celebratedMilestone: milestone });
  notifyStreakChanged();
}

/**
 * Count `date`'s Daily as finished (v1.18 rule: finishing the counted attempt's season, win or
 * lose). Updates streak, best streak, freezes, leaderboard sync and daily achievements.
 */
export function recordDailyChallengeCompletion(date = new Date()): void {
  recordDailyFinishForKey(todayKey(date));
}

function recordDailyFinishForKey(key: string): void {
  if (typeof window === "undefined") return;
  const meta = loadMeta(new Date());
  const progress = loadProgressMap();
  const result = applyDailyFinish(meta, progress, key);
  writeState(result.meta, result.progress);
  if (!result.counted) return;
  notifyStreakChanged();
  const { currentStreak, bestStreak } = result.meta;
  // Lazy imports avoid circular module init with leaderboard / achievements.
  void import("./storage/daily-leaderboard").then(({ syncDailyChallengeLeaderboard }) => {
    syncDailyChallengeLeaderboard(bestStreak);
  });
  void import("./achievements/achievementTriggers").then(
    ({ triggerDailyChallengeAchievements }) => {
      triggerDailyChallengeAchievements(currentStreak, bestStreak);
    }
  );
}

function maybeRecordPerfectDay(key: string): void {
  const meta = loadMeta(new Date());
  const progress = loadProgressMap();
  const perfect = applyPerfectDay(meta, progress, key);
  if (perfect.counted) {
    writeState(perfect.meta, perfect.progress);
    notifyStreakChanged();
  }
}

function maybeRecordCompletionFromProgress(
  progress: DailyProgress,
  date: Date
): void {
  // Either bonus means the counted attempt finished its regular season.
  if (progress.leagueLeaders || progress.playoffTitle) {
    recordDailyChallengeCompletion(date);
  }
  if (progress.leagueLeaders && progress.playoffTitle) {
    maybeRecordPerfectDay(todayKey(date));
  }
}

/**
 * Called when a Daily run finishes a phase (storage/run.ts). Only the day's counted attempt
 * (DAILY_ATTEMPT_KEY runId) counts: it finishes the day for the streak, stores the day's
 * result and score, and queues the score for the Daily board. Practice runs are ignored.
 */
export function recordDailyChallengeRunResult(input: {
  runId: string;
  phase: "regular" | "playoff";
  regularWins: number;
  leaguePosition: number;
  playoffWins?: number;
  grandFinal?: boolean;
}): { dayKey: string; score: number } | null {
  if (typeof window === "undefined") return null;
  const attempt = loadAttempt();
  if (!attempt || attempt.runId !== input.runId) return null;
  const key = attempt.date;
  const progress = loadProgressMap();
  const existing = progress[key]?.result;
  if (existing && existing.runId === input.runId && existing.final) {
    return { dayKey: key, score: computeDailyScore(existing) };
  }
  const reachedPlayoffs = input.leaguePosition <= 6;
  const result: DailyDayResult = {
    runId: input.runId,
    regularWins: input.regularWins,
    leaguePosition: input.leaguePosition,
    playoffWins: input.phase === "playoff" ? input.playoffWins ?? 0 : 0,
    grandFinal: input.phase === "playoff" ? input.grandFinal === true : false,
    final: input.phase === "playoff" || !reachedPlayoffs,
  };
  progress[key] = { ...progress[key], result };
  writeProgressMap(progress);
  recordDailyFinishForKey(key);
  maybeRecordPerfectDay(key);
  const score = computeDailyScore(result);
  void import("./storage/daily-leaderboard")
    .then(({ flushDailyScoreEntry }) => flushDailyScoreEntry())
    .catch(() => {
      /* offline: the board read retries */
    });
  return { dayKey: key, score };
}

/** The counted attempt's result for a day, with its Daily score (null if not played). */
export function getDailyChallengeDayResult(
  date = new Date()
): (DailyDayResult & { dayKey: string; score: number }) | null {
  const key = todayKey(date);
  const result = loadProgressMap()[key]?.result;
  return result ? { ...result, dayKey: key, score: computeDailyScore(result) } : null;
}

/** A day's stored result by key (used by the board flush). */
export function getDailyChallengeResultForKey(
  key: string
): (DailyDayResult & { dayKey: string; score: number }) | null {
  const result = loadProgressMap()[key]?.result;
  return result ? { ...result, dayKey: key, score: computeDailyScore(result) } : null;
}

/** Rule rotation — one daily challenge per UK calendar day. */
const ROTATION_SALT = "27-0-daily-v4";

function hashString(value: string): number {
  const seeded = `${ROTATION_SALT}:${value}`;
  let h = 2166136261;
  for (let i = 0; i < seeded.length; i++) {
    h ^= seeded.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key (calendar maths, no time zone). */
function dayIndexForKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** Deterministic shuffle of the rule types for one 7-day block (before the seam fix). */
function rawRuleBlock(block: number): DailyRuleType[] {
  const order = [...DAILY_RULE_TYPES];
  let state = hashString(`block:${block}`) || 1;
  const next = () => {
    // xorshift32 — tiny, deterministic, good enough for a shuffle.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * Every rule type plays once per 7-day block, in a shuffled order. If a block would open with
 * the type that closed the previous block, its first two days swap. Only days 0 and 1 ever
 * move, so a block's last day never changes and the check needs no recursion.
 */
function ruleBlock(block: number): DailyRuleType[] {
  const order = rawRuleBlock(block);
  const previousLast = rawRuleBlock(block - 1)[order.length - 1];
  if (order[0] === previousLast) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

function ruleTypeForKey(key: string): { type: DailyRuleType; block: number } {
  const dayIndex = dayIndexForKey(key);
  const n = DAILY_RULE_TYPES.length;
  const block = Math.floor(dayIndex / n);
  return { type: ruleBlock(block)[dayIndex - block * n]!, block };
}

/** Today's rule type (exported for tests and previews). */
export function getDailyRuleType(date = new Date()): DailyRuleType {
  return ruleTypeForKey(todayKey(date)).type;
}

function buildScenario(
  rule: DailyChallengeRule,
  eraMode: boolean,
  ruleTitle: string,
  ruleSummary: string,
  forceOpponentClub: string | null = null
): DailyChallengeScenario {
  const ruleKey =
    rule.type === "giant-killers" || rule.type === "one-club"
      ? `${rule.type}-${rule.club.toLowerCase().replace(/\s+/g, "-")}`
      : rule.type === "era-night"
        ? `era-night-${rule.fromYear}`
        : rule.type === "underdogs"
          ? `underdogs-${rule.maxRating}`
          : rule.type;
  return {
    id: `${eraMode ? "era" : "current"}-${ruleKey}`,
    title: ruleTitle,
    blurb: ruleSummary,
    rule,
    ruleType: rule.type,
    ruleTitle,
    ruleSummary,
    forceOpponentClub,
    eraMode,
    ...DAILY_RULE_BONUSES[rule.type],
  };
}

/**
 * Pick today's challenge: the rule type comes from the 7-day rotation; its parameter (club,
 * decade, Current vs Era) steps through its options once per block so it varies week to week.
 */
export function getDailyChallengeScenario(
  date = new Date()
): DailyChallengeScenario {
  const { type, block } = ruleTypeForKey(todayKey(date));
  return buildDailyRuleScenario(type, block);
}

/**
 * Build the scenario for one rule type at one rotation step. `block` picks the rule's parameter
 * (club, decade, rating cap, Current vs Era) so the same type varies from block to block. Shared
 * with the Weekly Challenge (lib/weekly-challenge.ts), which seeds it with a week index.
 */
export function buildDailyRuleScenario(
  type: DailyRuleType,
  block: number
): DailyChallengeScenario {
  const typeIndex = DAILY_RULE_TYPES.indexOf(type);
  // Current/Era alternates by week, offset per type so a week mixes both.
  const eraWeek = (block + typeIndex) % 2 === 1;

  switch (type) {
    case "giant-killers": {
      const club = GIANT_KILLER_CLUBS[block % GIANT_KILLER_CLUBS.length]!;
      return buildScenario(
        { type, club },
        eraWeek,
        "Giant killers",
        `Every opponent is ${club}. Beat the best.`,
        club
      );
    }
    case "one-club": {
      const option = ONE_CLUB_OPTIONS[block % ONE_CLUB_OPTIONS.length]!;
      return buildScenario(
        { type, club: option.club },
        true,
        `One club: ${option.short}`,
        `Every spin is a ${option.club} side, any era.`
      );
    }
    case "era-night": {
      const option = ERA_NIGHT_OPTIONS[block % ERA_NIGHT_OPTIONS.length]!;
      return buildScenario(
        { type, ...option },
        true,
        `Era night: ${option.label}`,
        `Every spin is a ${option.fromYear}–${option.toYear} Super League side.`
      );
    }
    case "underdogs": {
      const maxRating = eraWeek
        ? UNDERDOG_MAX_RATING.era
        : UNDERDOG_MAX_RATING.current;
      return buildScenario(
        { type, maxRating },
        eraWeek,
        `Underdogs: max ${maxRating}`,
        `No player rated above ${maxRating}. Win it with grafters.`
      );
    }
    case "no-respins":
      return buildScenario(
        { type },
        eraWeek,
        "No respins",
        "Respins are off. Every spin is final."
      );
    case "homegrown":
      return buildScenario(
        { type },
        eraWeek,
        "Homegrown",
        "English, Welsh, Scottish and Irish players only."
      );
    case "overseas":
      return buildScenario(
        { type },
        eraWeek,
        "Overseas stars",
        "Only players from outside Britain and Ireland."
      );
  }
}

export function getDailyChallengeHref(date = new Date()): string {
  const scenario = getDailyChallengeScenario(date);
  return scenario.eraMode ? "/play?daily=1&era=1" : "/play?daily=1";
}

export function isDailyChallengeActive(search: {
  daily?: string | null;
}): boolean {
  return search.daily === "1";
}

export function getDailyChallengeDateKey(date = new Date()): string {
  return todayKey(date);
}

export function getDailyChallengeLeagueRunId(date = new Date()): string {
  return `daily-${todayKey(date)}-league`;
}

export function getDailyChallengePlayoffRunId(date = new Date()): string {
  return `daily-${todayKey(date)}-playoff`;
}

/** @deprecated Use phase-specific run ids. */
export function getDailyChallengeRunId(date = new Date()): string {
  return getDailyChallengeLeagueRunId(date);
}

export interface DailyChallengeAttempt {
  date: string;
  runId: string;
}

/** Everything the cloud row backs up (see storage/daily-challenge-cloud.ts). */
export interface DailyChallengeSnapshot {
  meta: DailyChallengeMeta;
  progress: Record<string, DailyProgress>;
  attempt: DailyChallengeAttempt | null;
}

function loadProgressMap(): Record<string, DailyProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeClaims);
    if (!raw) return {};
    return normalizeDailyProgressMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function writeProgressMap(map: Record<string, DailyProgress>): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(map).sort();
  const trimmed: Record<string, DailyProgress> = {};
  for (const key of keys.slice(-60)) {
    trimmed[key] = map[key]!;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify(trimmed));
  } catch {
    // storage unavailable
  }
}

function saveProgressMap(map: Record<string, DailyProgress>): void {
  writeProgressMap(map);
  scheduleCloudSave();
}

export const DAILY_ATTEMPT_KEY = "27-0-daily-attempt";

function loadAttempt(): DailyChallengeAttempt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_ATTEMPT_KEY);
    const stored = raw ? (JSON.parse(raw) as { date?: unknown; runId?: unknown }) : null;
    if (stored && typeof stored.date === "string" && typeof stored.runId === "string") {
      return { date: stored.date, runId: stored.runId };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Current local Daily state, as backed up to the cloud. */
export function loadDailyChallengeSnapshot(): DailyChallengeSnapshot {
  const meta = loadMeta();
  return { meta, progress: loadProgressMap(), attempt: loadAttempt() };
}

/**
 * Overwrite local Daily state with a merged snapshot (login hydrate). Writes directly so the
 * merge itself doesn't queue another cloud save; the caller uploads the merged result.
 */
export function applyDailyChallengeSnapshot(snapshot: DailyChallengeSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.dailyChallengeMeta, JSON.stringify(snapshot.meta));
    const keys = Object.keys(snapshot.progress).sort();
    const trimmed: Record<string, DailyProgress> = {};
    for (const key of keys.slice(-60)) trimmed[key] = snapshot.progress[key]!;
    localStorage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify(trimmed));
    if (snapshot.attempt) {
      localStorage.setItem(DAILY_ATTEMPT_KEY, JSON.stringify(snapshot.attempt));
    } else {
      localStorage.removeItem(DAILY_ATTEMPT_KEY);
    }
  } catch {
    // storage unavailable
  }
}

/**
 * One counted Daily attempt per UK day. The first run started today claims it; later runs
 * (Leave run, reload, Play again) are practice and can't earn the Daily bonuses, so the Daily
 * can't be replayed until it's won. Idempotent for the same runId.
 */
export function claimDailyChallengeAttempt(runId: string, date = new Date()): boolean {
  if (typeof window === "undefined") return true;
  const key = todayKey(date);
  try {
    const raw = localStorage.getItem(DAILY_ATTEMPT_KEY);
    const stored = raw ? (JSON.parse(raw) as { date?: unknown; runId?: unknown }) : null;
    if (stored && stored.date === key && typeof stored.runId === "string") {
      return stored.runId === runId;
    }
    localStorage.setItem(DAILY_ATTEMPT_KEY, JSON.stringify({ date: key, runId }));
    scheduleCloudSave();
    return true;
  } catch {
    return true;
  }
}

/**
 * True when today's counted Daily attempt has already been started (read-only — never claims).
 * Later runs today are practice and can't earn the Daily bonuses.
 */
export function getDailyChallengeAttemptUsed(date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  const key = todayKey(date);
  try {
    const raw = localStorage.getItem(DAILY_ATTEMPT_KEY);
    const stored = raw ? (JSON.parse(raw) as { date?: unknown; runId?: unknown }) : null;
    return Boolean(stored && stored.date === key && typeof stored.runId === "string");
  } catch {
    return false;
  }
}

export function getDailyChallengeProgress(date = new Date()): DailyProgress {
  return loadProgressMap()[todayKey(date)] ?? {};
}

export function hasClaimedDailyChallengeBonus(date = new Date()): boolean {
  const p = getDailyChallengeProgress(date);
  return Boolean(p.leagueLeaders && p.playoffTitle);
}

/** Today's Daily has been finished (counts for the streak). */
export function hasFinishedDailyChallengeToday(date = new Date()): boolean {
  const p = getDailyChallengeProgress(date);
  return Boolean(p.finished || p.leagueLeaders || p.playoffTitle || p.result);
}

export function markDailyChallengeLeagueLeaders(date = new Date()): void {
  const key = todayKey(date);
  const map = loadProgressMap();
  const next = { ...map[key], leagueLeaders: true };
  map[key] = next;
  saveProgressMap(map);
  maybeRecordCompletionFromProgress(next, date);
}

export function markDailyChallengePlayoffTitle(date = new Date()): void {
  const key = todayKey(date);
  const map = loadProgressMap();
  const next = { ...map[key], playoffTitle: true };
  map[key] = next;
  saveProgressMap(map);
  maybeRecordCompletionFromProgress(next, date);
}

/** @deprecated */
export function markDailyChallengeBonusClaimed(date = new Date()): void {
  markDailyChallengeLeagueLeaders(date);
  markDailyChallengePlayoffTitle(date);
}

export function getDailyChallengeTotalBonus(
  scenario: DailyChallengeScenario
): number {
  return scenario.leagueLeadersBonus + scenario.playoffTitleBonus;
}

/** Smallest Daily bonuses across every rule — for "from £Xk" copy. */
export function getDailyChallengeMinimumBonuses(): {
  leagueLeadersBonus: number;
  playoffTitleBonus: number;
} {
  const all = Object.values(DAILY_RULE_BONUSES);
  return {
    leagueLeadersBonus: Math.min(...all.map((s) => s.leagueLeadersBonus)),
    playoffTitleBonus: Math.min(...all.map((s) => s.playoffTitleBonus)),
  };
}
