import type { GameDifficulty, GameMode } from "../types";
import { STORAGE_KEYS } from "./keys";
import { getUsername } from "./user";

export interface HallOfFameEntry {
  id: string;
  username: string;
  achievedAt: string;
  squadValue: number;
  mode: GameMode;
  difficulty: GameDifficulty;
  record: string;
}

function loadEntries(): HallOfFameEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.hallOfFame);
    if (!raw) return [];
    return JSON.parse(raw) as HallOfFameEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: HallOfFameEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.hallOfFame, JSON.stringify(entries));
}

export function addHallOfFameEntry(
  squadValue: number,
  mode: GameMode,
  difficulty: GameDifficulty,
  achievedAt = new Date()
): void {
  const entries = loadEntries();
  entries.unshift({
    id: `hof-${Date.now()}`,
    username: getUsername() ?? "Unknown",
    achievedAt: achievedAt.toISOString(),
    squadValue,
    mode,
    difficulty,
    record: "27-0",
  });
  saveEntries(entries.slice(0, 50));
}

export function getHallOfFame(): HallOfFameEntry[] {
  return loadEntries();
}

export function hasHallOfFameEntry(username: string): boolean {
  return loadEntries().some((e) => e.username === username);
}
