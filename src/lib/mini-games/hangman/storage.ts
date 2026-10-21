import { STORAGE_KEYS } from "@/lib/storage/keys";
import { HANGMAN_STATS_SCHEMA, type HangmanRun, type HangmanStats } from "./types";
import { createEmptyHangmanStats } from "./stats-defaults";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode
  }
}

function isHangmanRun(value: unknown): value is HangmanRun {
  if (!isRecord(value)) return false;
  if (
    !(
      typeof value.id === "string" &&
      typeof value.date === "string" &&
      typeof value.daily === "boolean" &&
      typeof value.puzzleId === "string" &&
      typeof value.answer === "string" &&
      Array.isArray(value.guessed) &&
      (value.status === "playing" ||
        value.status === "won" ||
        value.status === "lost")
    )
  ) {
    return false;
  }
  if (
    value.isHistoric !== undefined &&
    typeof value.isHistoric !== "boolean"
  ) {
    return false;
  }
  if (value.year !== undefined && typeof value.year !== "number") {
    return false;
  }
  if (
    value.poolMode !== undefined &&
    value.poolMode !== "current" &&
    value.poolMode !== "era"
  ) {
    return false;
  }
  return true;
}

export function loadHangmanRun(): HangmanRun | null {
  const value = readJson(STORAGE_KEYS.hangmanRun);
  return isHangmanRun(value) ? value : null;
}

export function saveHangmanRun(run: HangmanRun): void {
  writeJson(STORAGE_KEYS.hangmanRun, run);
}

const DAILY_PREFIX = "27-0-hangman-daily:";

/** Today's daily puzzle for a pool, so a reload resumes it instead of granting a fresh attempt. */
export function loadHangmanDaily(date: string, poolMode: string): HangmanRun | null {
  const value = readJson(`${DAILY_PREFIX}${date}:${poolMode}`);
  return isHangmanRun(value) ? value : null;
}

export function saveHangmanDaily(run: HangmanRun): void {
  if (!run.daily) return;
  writeJson(`${DAILY_PREFIX}${run.date}:${run.poolMode ?? "current"}`, run);
  // Keep only today's entries.
  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(DAILY_PREFIX) && !key.startsWith(`${DAILY_PREFIX}${run.date}:`)) localStorage.removeItem(key);
    }
  } catch {
    // Quota / private mode
  }
}

export function clearHangmanRun(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.hangmanRun);
  } catch {
    // Quota / private mode
  }
}

export function loadHangmanStats(): HangmanStats {
  const value = readJson(STORAGE_KEYS.hangmanStats);
  if (!isRecord(value) || value.schemaVersion !== HANGMAN_STATS_SCHEMA) {
    return createEmptyHangmanStats();
  }
  return {
    schemaVersion: HANGMAN_STATS_SCHEMA,
    played: typeof value.played === "number" ? value.played : 0,
    wins: typeof value.wins === "number" ? value.wins : 0,
    currentStreak:
      typeof value.currentStreak === "number" ? value.currentStreak : 0,
    bestStreak: typeof value.bestStreak === "number" ? value.bestStreak : 0,
    lastDailyWinDate:
      typeof value.lastDailyWinDate === "string"
        ? value.lastDailyWinDate
        : null,
  };
}

export function saveHangmanStats(stats: HangmanStats): void {
  writeJson(STORAGE_KEYS.hangmanStats, stats);
}
