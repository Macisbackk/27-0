export const HANGMAN_MAX_WRONG = 8;
export const HANGMAN_STATS_SCHEMA = 1;

export type HangmanCategory =
  | "player"
  | "club"
  | "stadium"
  | "coach"
  | "competition"
  | "term";

export type HangmanPuzzle = {
  id: string;
  category: HangmanCategory;
  answer: string;
  hint: string;
};

export type HangmanStatus = "playing" | "won" | "lost";

export type HangmanRun = {
  id: string;
  date: string;
  daily: boolean;
  puzzleId: string;
  category: HangmanCategory;
  answer: string;
  hint: string;
  guessed: string[];
  status: HangmanStatus;
  rewardClaimed: boolean;
};

export type HangmanStats = {
  schemaVersion: number;
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastDailyWinDate: string | null;
};
