import { STORAGE_KEYS } from "./storage/keys";

export const DAILY_CHALLENGE_BONUS = 25_000;
export const DAILY_CHALLENGE_MODE = "CLASSIC" as const;

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDailyChallengeDateKey(date = new Date()): string {
  return todayKey(date);
}

export function getDailyChallengeRunId(date = new Date()): string {
  return `daily-${todayKey(date)}`;
}

export function getDailyChallengeHref(): string {
  return "/play?daily=1";
}

export function isDailyChallengeActive(search: {
  daily?: string | null;
}): boolean {
  return search.daily === "1";
}

/** Local claim tracker so UI can show completed without waiting for funds payout. */
export function hasClaimedDailyChallengeBonus(date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeClaims);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.includes(todayKey(date));
  } catch {
    return false;
  }
}

export function markDailyChallengeBonusClaimed(date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    const key = todayKey(date);
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeClaims);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const list = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    if (list.includes(key)) return;
    const next = [...list, key].slice(-60);
    localStorage.setItem(STORAGE_KEYS.dailyChallengeClaims, JSON.stringify(next));
  } catch {
    // ignore
  }
}
