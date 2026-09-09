import type { MiniGamePlayer } from "../players";

export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_STATS_SCHEMA = 2;

export type WordleClueTone = "match" | "miss";
export type WordleTrend = "higher" | "lower" | "match";

export type WordleAttributeKey = "nationality" | "position" | "club" | "rating";

export type WordleClues = {
  nationality: WordleClueTone;
  position: WordleClueTone;
  club: WordleClueTone;
  rating: WordleTrend;
};

export type WordleDiscoveredClue = {
  key: WordleAttributeKey;
  label: string;
  order: number;
};

/** One-time optional reveal of a single answer attribute. */
export type WordleAnswerHint = {
  key: WordleAttributeKey;
  label: string;
  value: string;
};

export type WordleGuess = {
  playerId: string;
  name: string;
  club: string;
  positionLabel: string;
  nationality: string;
  rating: number;
  isHistoric?: boolean;
  year?: number;
  clues: WordleClues;
};

export type WordleStatus = "playing" | "won" | "lost";

export type WordleRun = {
  date: string;
  answerId: string;
  guesses: WordleGuess[];
  discoveredClues: WordleDiscoveredClue[];
  /** True after the optional one-time attribute reveal is used. */
  hintUsed: boolean;
  answerHint: WordleAnswerHint | null;
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

export const WORDLE_ATTRIBUTE_LABEL: Record<WordleAttributeKey, string> = {
  nationality: "NATION",
  position: "POSITION",
  club: "CLUB",
  rating: "RATING",
};
