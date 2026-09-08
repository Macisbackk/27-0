import type { MiniGamePlayer } from "../players";

export const HIGHER_LOWER_STATS_SCHEMA = 1;

export type HigherLowerChoice = "left" | "right";

export type HigherLowerPair = {
  left: MiniGamePlayer;
  right: MiniGamePlayer;
};

export type HigherLowerRun = {
  seed: string;
  roundIndex: number;
  leftId: string;
  rightId: string;
  revealed: boolean;
  lastChoice: HigherLowerChoice | null;
  lastCorrect: boolean | null;
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
