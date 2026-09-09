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
  const status = value.status;
  if (
    !(
      typeof value.seed === "string" &&
      typeof value.pickIndex === "number" &&
      value.pickIndex >= 0 &&
      value.pickIndex < 5 &&
      Array.isArray(value.usedIds) &&
      typeof value.baseId === "string" &&
      typeof value.challengeId === "string" &&
      typeof value.revealed === "boolean" &&
      (status === "playing" || status === "lost" || status === "won") &&
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

export function loadHigherLowerRun(): HigherLowerRun | null {
  const value = readJson(STORAGE_KEYS.higherLowerRun);
  return isHigherLowerRun(value) ? value : null;
}

export function saveHigherLowerRun(run: HigherLowerRun): void {
  writeJson(STORAGE_KEYS.higherLowerRun, run);
}

export function clearHigherLowerRun(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.higherLowerRun);
  } catch {
    // ignore
  }
}

export function loadHigherLowerStats(): HigherLowerStats {
  const value = readJson(STORAGE_KEYS.higherLowerStats);
  if (!isRecord(value)) {
    return createEmptyHigherLowerStats();
  }
  return {
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    currentStreak:
      typeof value.currentStreak === "number" ? value.currentStreak : 0,
    bestStreak: typeof value.bestStreak === "number" ? value.bestStreak : 0,
    plays: typeof value.plays === "number" ? value.plays : 0,
    correct: typeof value.correct === "number" ? value.correct : 0,
    fivePickWins:
      typeof value.fivePickWins === "number" ? value.fivePickWins : 0,
    failedRuns: typeof value.failedRuns === "number" ? value.failedRuns : 0,
    lastRewardedRunId:
      typeof value.lastRewardedRunId === "string"
        ? value.lastRewardedRunId
        : null,
  };
}

export function saveHigherLowerStats(stats: HigherLowerStats): void {
  writeJson(STORAGE_KEYS.higherLowerStats, {
    ...stats,
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
  });
}
