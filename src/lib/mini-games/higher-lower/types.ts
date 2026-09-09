import type { MiniGamePlayer } from "../players";
import type { MiniGamePoolMode } from "../pool-mode";

export const HIGHER_LOWER_STATS_SCHEMA = 3;
export const HIGHER_LOWER_PICKS = 5;

export type HigherLowerChoice = "higher" | "lower";

export type HigherLowerStatus = "playing" | "lost" | "won";

export type HigherLowerRun = {
  seed: string;
  /** Zero-based pick index. Final successful pick is 4 (PICK 5 / 5). */
  pickIndex: number;
  usedIds: string[];
  /** Comparison baseline — current player. */
  baseId: string;
  /** Challenge player — rating hidden until guess. */
  challengeId: string;
  revealed: boolean;
  lastChoice: HigherLowerChoice | null;
  lastCorrect: boolean | null;
  status: HigherLowerStatus;
  rewardClaimed: boolean;
  /** Current vs Era pool for this run. */
  poolMode?: MiniGamePoolMode;
};

export type HigherLowerStats = {
  schemaVersion: number;
  /** Consecutive five-pick completions. */
  currentStreak: number;
  bestStreak: number;
  /** Completed runs (wins + losses). */
  plays: number;
  /** Individual correct picks across all runs. */
  correct: number;
  fivePickWins: number;
  failedRuns: number;
  lastRewardedRunId: string | null;
};

export type HigherLowerBoard = {
  base: MiniGamePlayer;
  challenge: MiniGamePlayer;
};
