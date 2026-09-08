import { STORAGE_KEYS } from "@/lib/storage/keys";
import {
  HIGHER_LOWER_STATS_SCHEMA,
  type HigherLowerRun,
  type HigherLowerStats,
} from "./types";
import { createEmptyHigherLowerStats } from "./engine";

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

function isHigherLowerRun(value: unknown): value is HigherLowerRun {
  if (!isRecord(value)) return false;
  return (
    typeof value.seed === "string" &&
    typeof value.roundIndex === "number" &&
    typeof value.leftId === "string" &&
    typeof value.rightId === "string" &&
    typeof value.revealed === "boolean"
  );
}

export function loadHigherLowerRun(): HigherLowerRun | null {
  const value = readJson(STORAGE_KEYS.higherLowerRun);
  return isHigherLowerRun(value) ? value : null;
}

export function saveHigherLowerRun(run: HigherLowerRun): void {
  writeJson(STORAGE_KEYS.higherLowerRun, run);
}

export function loadHigherLowerStats(): HigherLowerStats {
  const value = readJson(STORAGE_KEYS.higherLowerStats);
  if (!isRecord(value) || value.schemaVersion !== HIGHER_LOWER_STATS_SCHEMA) {
    return createEmptyHigherLowerStats();
  }
  return {
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    currentStreak:
      typeof value.currentStreak === "number" ? value.currentStreak : 0,
    bestStreak: typeof value.bestStreak === "number" ? value.bestStreak : 0,
    plays: typeof value.plays === "number" ? value.plays : 0,
    correct: typeof value.correct === "number" ? value.correct : 0,
    lastFiveRewardDate:
      typeof value.lastFiveRewardDate === "string"
        ? value.lastFiveRewardDate
        : null,
    lastTenRewardDate:
      typeof value.lastTenRewardDate === "string"
        ? value.lastTenRewardDate
        : null,
  };
}

export function saveHigherLowerStats(stats: HigherLowerStats): void {
  writeJson(STORAGE_KEYS.higherLowerStats, stats);
}
