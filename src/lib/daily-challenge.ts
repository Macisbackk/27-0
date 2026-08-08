import { STORAGE_KEYS } from "./storage/keys";

export const DAILY_CHALLENGE_MODE = "CLASSIC" as const;

export type DailyChallengeKind = string;

export interface DailyChallengeScenario {
  id: DailyChallengeKind;
  title: string;
  blurb: string;
  /** Force every league opponent to this club name. */
  forceOpponentClub: string;
  leagueLeadersBonus: number;
  playoffTitleBonus: number;
}

/** Current Super League clubs that rotate as the all-league daily opponent. */
const DAILY_OPPONENT_CLUBS = [
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

function scenarioForClub(club: string): DailyChallengeScenario {
  const short = club
    .replace(/\s+(Warriors|Rhinos|Dragons|Wolves|Giants|Leopards|Tigers|Red Devils|Trinity)$/i, "")
    .trim();
  return {
    id: `all-${club.toLowerCase().replace(/\s+/g, "-")}`,
    title: club,
    blurb: `Every opponent is ${club}.`,
    forceOpponentClub: club,
    leagueLeadersBonus: short === "Wigan" || short === "St Helens" ? 75_000 : 70_000,
    playoffTitleBonus: short === "Wigan" || short === "St Helens" ? 150_000 : 140_000,
  };
}

const SCENARIOS: DailyChallengeScenario[] =
  DAILY_OPPONENT_CLUBS.map(scenarioForClub);

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Salt so consecutive calendar days land on different clubs. */
const ROTATION_SALT = "27-0-daily-v2";

function hashDateKey(key: string): number {
  const seeded = `${ROTATION_SALT}:${key}`;
  let h = 2166136261;
  for (let i = 0; i < seeded.length; i++) {
    h ^= seeded.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailyChallengeDateKey(date = new Date()): string {
  return todayKey(date);
}

export function getDailyChallengeScenario(
  date = new Date()
): DailyChallengeScenario {
  const key = todayKey(date);
  const idx = hashDateKey(key) % SCENARIOS.length;
  const scenario = SCENARIOS[idx]!;

  // Guarantee a different club than yesterday (hash collisions / small pools).
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const prevIdx = hashDateKey(todayKey(yesterday)) % SCENARIOS.length;
  if (prevIdx === idx && SCENARIOS.length > 1) {
    return SCENARIOS[(idx + 1) % SCENARIOS.length]!;
  }
  return scenario;
}

export function getDailyChallengeHref(): string {
  return "/play?daily=1";
}

export function isDailyChallengeActive(search: {
  daily?: string | null;
}): boolean {
  return search.daily === "1";
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
  map[key] = { ...map[key], leagueLeaders: true };
  saveProgressMap(map);
}

export function markDailyChallengePlayoffTitle(date = new Date()): void {
  const key = todayKey(date);
  const map = loadProgressMap();
  map[key] = { ...map[key], playoffTitle: true };
  saveProgressMap(map);
}

/** @deprecated */
export function markDailyChallengeBonusClaimed(date = new Date()): void {
  markDailyChallengeLeagueLeaders(date);
  markDailyChallengePlayoffTitle(date);
}

export function getDailyChallengeTotalBonus(scenario: DailyChallengeScenario): number {
  return scenario.leagueLeadersBonus + scenario.playoffTitleBonus;
}
