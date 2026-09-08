import type { MiniGamePlayer } from "../players";

export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_STATS_SCHEMA = 1;

export type WordleClueTone = "match" | "miss";
export type WordleTrend = "higher" | "lower" | "match";

export type WordleClues = {
  club: WordleClueTone;
  position: WordleClueTone;
  nationality: WordleClueTone;
  rating: WordleTrend;
  year: WordleTrend;
};

export type WordleGuess = {
  playerId: string;
  name: string;
  club: string;
  positionLabel: string;
  nationality: string;
  rating: number;
  year: number;
  isHistoric: boolean;
  clues: WordleClues;
};

export type WordleStatus = "playing" | "won" | "lost";

export type WordleRun = {
  date: string;
  answerId: string;
  guesses: WordleGuess[];
  status: WordleStatus;
  rewardClaimed: boolean;
};

export type WordleStats = {
  schemaVersion: number;
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
};

export type WordleAnswer = MiniGamePlayer;
