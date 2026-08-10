import { ERA_PLAYABLE_CLUBS } from "./clubs/super-league-display";
import { STORAGE_KEYS } from "./storage/keys";

export const DAILY_CHALLENGE_MODE = "CLASSIC" as const;

export interface DailyChallengeMeta {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDateKey: string | null;
}

const DEFAULT_META: DailyChallengeMeta = {
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedDateKey: null,
};

export type DailyChallengeKind = string;

export interface DailyChallengeScenario {
  id: DailyChallengeKind;
  title: string;
  blurb: string;
  /** Force every league opponent to this club name. */
  forceOpponentClub: string;
  /** Historic spin pool + Era sim when true. */
  eraMode: boolean;
  leagueLeadersBonus: number;
  playoffTitleBonus: number;
}

/** Current Super League clubs for Current-style dailies. */
const DAILY_CURRENT_OPPONENT_CLUBS = [
  "Wigan Warriors",
  "St Helens",
  "Leeds Rhinos",
  "Catalans Dragons",
  "Hull KR",
  "Warrington Wolves",
  "Huddersfield Giants",
  "Hull FC",
  "Leigh Leopards",
  "Castleford Tigers",
  "Wakefield Trinity",
  "Bradford Bulls",
  "Toulouse Olympique",
  "York Knights",
] as const;

/** Era-style dailies — Current clubs plus historic-only Super League sides. */
const DAILY_ERA_OPPONENT_CLUBS = [...ERA_PLAYABLE_CLUBS] as const;

function scenarioForClub(
  club: string,
  eraMode: boolean
): DailyChallengeScenario {
  const short = club
    .replace(
      /\s+(Warriors|Rhinos|Dragons|Wolves|Giants|Leopards|Tigers|Red Devils|Trinity|Broncos|Vikings|Bulls)$/i,
      ""
    )
    .trim();
  const eliteHome = short === "Wigan" || short === "St Helens";
  return {
    id: `${eraMode ? "era" : "current"}-all-${club
      .toLowerCase()
      .replace(/\s+/g, "-")}`,
    title: club,
    blurb: eraMode
      ? `Era — all ${club}.`
      : `Current — all ${club}.`,
    forceOpponentClub: club,
    eraMode,
    leagueLeadersBonus: eliteHome ? 75_000 : 70_000,
    playoffTitleBonus: eliteHome ? 150_000 : 140_000,
  };
}

const CURRENT_SCENARIOS: DailyChallengeScenario[] =
  DAILY_CURRENT_OPPONENT_CLUBS.map((club) => scenarioForClub(club, false));

const ERA_SCENARIOS: DailyChallengeScenario[] = DAILY_ERA_OPPONENT_CLUBS.map(
  (club) => scenarioForClub(club, true)
);

/** UK calendar day — matches Super League fixture day and avoids SSR/client TZ skew. */
function todayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Previous UK calendar day relative to `date`'s London date key. */
function yesterdayKey(date = new Date()): string {
  const [y, m, d] = todayKey(date).split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

function loadMeta(): DailyChallengeMeta {
  if (typeof window === "undefined") return { ...DEFAULT_META };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeMeta);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<DailyChallengeMeta>;
    return {
      currentStreak:
        typeof parsed.currentStreak === "number" && parsed.currentStreak >= 0
          ? Math.floor(parsed.currentStreak)
          : 0,
      bestStreak:
        typeof parsed.bestStreak === "number" && parsed.bestStreak >= 0
          ? Math.floor(parsed.bestStreak)
          : 0,
      lastCompletedDateKey:
        typeof parsed.lastCompletedDateKey === "string"
          ? parsed.lastCompletedDateKey
          : null,
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

function saveMeta(meta: DailyChallengeMeta): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.dailyChallengeMeta, JSON.stringify(meta));
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

/**
 * Record a fully completed daily (League Leaders + Grand Final claimed).
 * Updates streak, best streak, leaderboard sync, and daily achievements.
 */
export function recordDailyChallengeCompletion(date = new Date()): void {
  const today = todayKey(date);
  const meta = loadMeta();
  if (meta.lastCompletedDateKey === today) return;

  const yesterday = yesterdayKey(date);
  const currentStreak =
    meta.lastCompletedDateKey === yesterday ? meta.currentStreak + 1 : 1;
  const bestStreak = Math.max(meta.bestStreak, currentStreak);
  const next: DailyChallengeMeta = {
    currentStreak,
    bestStreak,
    lastCompletedDateKey: today,
  };
  saveMeta(next);
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

function maybeRecordCompletionFromProgress(
  progress: DailyProgress,
  date: Date
): void {
  if (progress.leagueLeaders && progress.playoffTitle) {
    recordDailyChallengeCompletion(date);
  }
}

/** Style + club rotation — one daily challenge per calendar day. */
const ROTATION_SALT = "27-0-daily-v3";

function hashDateKey(key: string): number {
  const seeded = `${ROTATION_SALT}:${key}`;
  let h = 2166136261;
  for (let i = 0; i < seeded.length; i++) {
    h ^= seeded.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickRawScenario(date: Date): {
  scenario: DailyChallengeScenario;
  pool: DailyChallengeScenario[];
  idx: number;
} {
  const key = todayKey(date);
  const hash = hashDateKey(key);
  const eraMode = hash % 2 === 1;
  const pool = eraMode ? ERA_SCENARIOS : CURRENT_SCENARIOS;
  const idx = Math.floor(hash / 2) % pool.length;
  return { scenario: pool[idx]!, pool, idx };
}

/**
 * Pick today's single challenge: Current- or Era-style, then a club from that
 * pool. Avoids repeating yesterday's resolved club when possible.
 */
export function getDailyChallengeScenario(
  date = new Date()
): DailyChallengeScenario {
  const today = pickRawScenario(date);

  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = pickRawScenario(yesterday);
  const dayBefore = new Date(yesterday);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const before = pickRawScenario(dayBefore);
  // Yesterday's displayed club (one-level bump vs day-before raw).
  const yesterdayClub =
    before.scenario.forceOpponentClub === y.scenario.forceOpponentClub &&
    y.pool.length > 1
      ? y.pool[(y.idx + 1) % y.pool.length]!.forceOpponentClub
      : y.scenario.forceOpponentClub;

  if (
    yesterdayClub === today.scenario.forceOpponentClub &&
    today.pool.length > 1
  ) {
    return today.pool[(today.idx + 1) % today.pool.length]!;
  }
  return today.scenario;
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

interface DailyProgress {
  leagueLeaders?: boolean;
  playoffTitle?: boolean;
}

function loadProgressMap(): Record<string, DailyProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeClaims);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const map: Record<string, DailyProgress> = {};
      for (const key of parsed) {
        if (typeof key === "string") {
          map[key] = { leagueLeaders: true, playoffTitle: true };
        }
      }
      return map;
    }
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, DailyProgress>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveProgressMap(map: Record<string, DailyProgress>): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(map).sort();
  const trimmed: Record<string, DailyProgress> = {};
  for (const key of keys.slice(-60)) {
    trimmed[key] = map[key]!;
  }
  localStorage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify(trimmed));
}

export function getDailyChallengeProgress(date = new Date()): DailyProgress {
  return loadProgressMap()[todayKey(date)] ?? {};
}

export function hasClaimedDailyChallengeBonus(date = new Date()): boolean {
  const p = getDailyChallengeProgress(date);
  return Boolean(p.leagueLeaders && p.playoffTitle);
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
