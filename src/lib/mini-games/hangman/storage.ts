import { STORAGE_KEYS } from "@/lib/storage/keys";
import { HANGMAN_STATS_SCHEMA, type HangmanRun, type HangmanStats } from "./types";
import { createEmptyHangmanStats } from "./engine";

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
  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    typeof value.daily === "boolean" &&
    typeof value.puzzleId === "string" &&
    typeof value.answer === "string" &&
    Array.isArray(value.guessed) &&
    (value.status === "playing" ||
      value.status === "won" ||
      value.status === "lost")
  );
}

export function loadHangmanRun(): HangmanRun | null {
  const value = readJson(STORAGE_KEYS.hangmanRun);
  return isHangmanRun(value) ? value : null;
}

export function saveHangmanRun(run: HangmanRun): void {
  writeJson(STORAGE_KEYS.hangmanRun, run);
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
