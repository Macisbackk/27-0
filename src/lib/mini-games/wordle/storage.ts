import { STORAGE_KEYS } from "@/lib/storage/keys";
import { WORDLE_STATS_SCHEMA, type WordleRun, type WordleStats } from "./types";
import { createEmptyWordleStats, normalizeWordleRun } from "./engine";

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

function isWordleRun(value: unknown): value is WordleRun {
  if (!isRecord(value)) return false;
  if (
    !(
      typeof value.date === "string" &&
      typeof value.answerId === "string" &&
      Array.isArray(value.guesses) &&
      (value.status === "playing" ||
        value.status === "won" ||
        value.status === "lost") &&
      typeof value.rewardClaimed === "boolean"
    )
  ) {
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

export function loadWordleRun(): WordleRun | null {
  const value = readJson(STORAGE_KEYS.wordleRun);
  if (!isWordleRun(value)) return null;
  return normalizeWordleRun({
    ...value,
    discoveredClues: Array.isArray((value as WordleRun).discoveredClues)
      ? (value as WordleRun).discoveredClues
      : [],
  });
}

export function saveWordleRun(run: WordleRun): void {
  writeJson(STORAGE_KEYS.wordleRun, run);
}

export function clearWordleRun(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.wordleRun);
  } catch {
    // Quota / private mode
  }
}

export function loadWordleStats(): WordleStats {
  const value = readJson(STORAGE_KEYS.wordleStats);
  if (!isRecord(value) || value.schemaVersion !== WORDLE_STATS_SCHEMA) {
    return createEmptyWordleStats();
  }
  return {
    schemaVersion: WORDLE_STATS_SCHEMA,
    played: typeof value.played === "number" ? value.played : 0,
    wins: typeof value.wins === "number" ? value.wins : 0,
    currentStreak:
      typeof value.currentStreak === "number" ? value.currentStreak : 0,
    bestStreak: typeof value.bestStreak === "number" ? value.bestStreak : 0,
    lastPlayedDate:
      typeof value.lastPlayedDate === "string" ? value.lastPlayedDate : null,
  };
}

export function saveWordleStats(stats: WordleStats): void {
  writeJson(STORAGE_KEYS.wordleStats, stats);
}
