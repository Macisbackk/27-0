import type { HangmanStats } from "./types";

export function createEmptyHangmanStats(): HangmanStats {
  return {
    schemaVersion: 1,
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastDailyWinDate: null,
  };
}
