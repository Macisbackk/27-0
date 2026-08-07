import { STORAGE_KEYS } from "./storage/keys";

export const DAILY_CHALLENGE_MODE = "CLASSIC" as const;

export type DailyChallengeKind =
  | "all-wigan"
  | "all-saints"
  | "all-leeds"
  | "mirror-league";

export interface DailyChallengeScenario {
  id: DailyChallengeKind;
  title: string;
  blurb: string;
  /** Force every league opponent to this club name. */
  forceOpponentClub: string;
  leagueLeadersBonus: number;
  playoffTitleBonus: number;
}

const SCENARIOS: DailyChallengeScenario[] = [
  {
    id: "all-wigan",
    title: "Warriors Everywhere",
    blurb:
      "Every rival is Wigan Warriors. Finish League Leaders, then win the Grand Final.",
    forceOpponentClub: "Wigan Warriors",
    leagueLeadersBonus: 75_000,
    playoffTitleBonus: 150_000,
  },
  {
    id: "all-saints",
    title: "Saints Gauntlet",
    blurb:
      "The league is full of St Helens sides. Top the table, then lift the title.",
    forceOpponentClub: "St Helens",
    leagueLeadersBonus: 75_000,
    playoffTitleBonus: 150_000,
  },
  {
    id: "all-leeds",
    title: "Rhinos Rematch",
    blurb:
      "Face Leeds Rhinos every week. Claim League Leaders, then the Grand Final.",
    forceOpponentClub: "Leeds Rhinos",
    leagueLeadersBonus: 70_000,
    playoffTitleBonus: 140_000,
  },
  {
    id: "mirror-league",
    title: "Catalans Mirror",
    blurb:
      "A league of Catalans Dragons clones. Win the league race, then the play-offs.",
    forceOpponentClub: "Catalans Dragons",
    leagueLeadersBonus: 70_000,
    playoffTitleBonus: 140_000,
  },
];

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashDateKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getDailyChallengeDateKey(date = new Date()): string {
  return todayKey(date);
}

export function getDailyChallengeScenario(
  date = new Date()
): DailyChallengeScenario {
  const idx = hashDateKey(todayKey(date)) % SCENARIOS.length;
  return SCENARIOS[idx]!;
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
      // Migrate legacy string[] claims → completed both phases
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
