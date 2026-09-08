import type { MiniGamePlayer } from "../players";

export const HIGHER_LOWER_STATS_SCHEMA = 2;

export type HigherLowerChoice = "higher" | "lower";

export type HigherLowerStatus = "playing" | "lost";

export type HigherLowerRun = {
  seed: string;
  roundIndex: number;
  /** Up to five visible history cards (names). */
  historyIds: string[];
  /** Comparison baseline — last settled player. */
  baseId: string;
  /** Challenge player — rating hidden until guess. */
  challengeId: string;
  revealed: boolean;
  lastChoice: HigherLowerChoice | null;
  lastCorrect: boolean | null;
  status: HigherLowerStatus;
};

export type HigherLowerStats = {
  schemaVersion: number;
  currentStreak: number;
  bestStreak: number;
  plays: number;
  correct: number;
  lastFiveRewardDate: string | null;
  lastTenRewardDate: string | null;
};

export type HigherLowerBoard = {
  history: MiniGamePlayer[];
  base: MiniGamePlayer;
  challenge: MiniGamePlayer;
};
