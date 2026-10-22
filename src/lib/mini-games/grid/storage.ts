import { STORAGE_KEYS } from "@/lib/storage/keys";
import { GRID_STATS_SCHEMA, type GridRun, type GridStats } from "./types";
import { createEmptyGridStats, isGridRun } from "./run-utils";

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

/** The saved daily grid (practice grids are never persisted). */
export function loadGridRun(): GridRun | null {
  const value = readJson(STORAGE_KEYS.gridRun);
  return isGridRun(value) ? value : null;
}

export function saveGridRun(run: GridRun): void {
  if (run.mode !== "daily") return;
  writeJson(STORAGE_KEYS.gridRun, run);
}

export function loadGridStats(): GridStats {
  const value = readJson(STORAGE_KEYS.gridStats);
  if (!isRecord(value) || value.schemaVersion !== GRID_STATS_SCHEMA) {
    return createEmptyGridStats();
  }
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  return {
    schemaVersion: GRID_STATS_SCHEMA,
    played: n(value.played),
    perfect: n(value.perfect),
    totalCorrect: n(value.totalCorrect),
    bestScore: n(value.bestScore),
    currentStreak: n(value.currentStreak),
    bestStreak: n(value.bestStreak),
    lastPlayedDate:
      typeof value.lastPlayedDate === "string" ? value.lastPlayedDate : null,
  };
}

export function saveGridStats(stats: GridStats): void {
  writeJson(STORAGE_KEYS.gridStats, stats);
}
