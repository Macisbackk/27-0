/** Grid run/stat helpers with no player-database dependency (used by storage). */
import {
  GRID_CELL_COUNT,
  GRID_SIZE,
  GRID_STATS_SCHEMA,
  type GridCellEntry,
  type GridRun,
  type GridStats,
} from "./types";

export function createEmptyGridStats(): GridStats {
  return {
    schemaVersion: GRID_STATS_SCHEMA,
    played: 0,
    perfect: 0,
    totalCorrect: 0,
    bestScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: null,
  };
}

export function gridScore(run: Pick<GridRun, "cells">): number {
  return run.cells.filter((cell) => cell !== null).length;
}

/** YYYY-MM-DD of the day before `dateKey` (calendar arithmetic, no timezone drift). */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return "";
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
}

/** Daily grids only: practice grids never touch stats. */
export function recordGridResult(stats: GridStats, run: GridRun): GridStats {
  if (run.mode !== "daily" || run.status !== "finished") return stats;
  if (stats.lastPlayedDate === run.dateKey) return stats;
  const score = gridScore(run);
  const continues =
    stats.lastPlayedDate !== null &&
    stats.lastPlayedDate === previousDateKey(run.dateKey);
  const currentStreak = continues ? stats.currentStreak + 1 : 1;
  return {
    schemaVersion: GRID_STATS_SCHEMA,
    played: stats.played + 1,
    perfect: stats.perfect + (score === GRID_CELL_COUNT ? 1 : 0),
    totalCorrect: stats.totalCorrect + score,
    bestScore: Math.max(stats.bestScore, score),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastPlayedDate: run.dateKey,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCellEntry(value: unknown): value is GridCellEntry | null {
  if (value === null) return true;
  return (
    isRecord(value) &&
    typeof value.playerId === "string" &&
    typeof value.name === "string"
  );
}

function isStringList(value: unknown, length: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === "string")
  );
}

/** Shape check for a persisted run (criteria ids are re-validated by the engine). */
export function isGridRun(value: unknown): value is GridRun {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.mode === "daily" || value.mode === "practice") &&
    typeof value.seed === "string" &&
    typeof value.dateKey === "string" &&
    isStringList(value.rows, GRID_SIZE) &&
    isStringList(value.cols, GRID_SIZE) &&
    Array.isArray(value.cells) &&
    value.cells.length === GRID_CELL_COUNT &&
    value.cells.every(isCellEntry) &&
    typeof value.guessesUsed === "number" &&
    (value.status === "playing" || value.status === "finished") &&
    typeof value.rewardClaimed === "boolean"
  );
}
