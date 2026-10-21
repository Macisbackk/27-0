import { HIGHER_LOWER_STATS_SCHEMA, type HigherLowerStats } from "./types";

export function createEmptyHigherLowerStats(): HigherLowerStats {
  return {
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    currentStreak: 0,
    bestStreak: 0,
    plays: 0,
    correct: 0,
    fivePickWins: 0,
    failedRuns: 0,
    lastRewardedRunId: null,
  };
}
