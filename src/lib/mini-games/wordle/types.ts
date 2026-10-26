import type { MiniGamePlayer } from "../players";
import type { MiniGamePoolMode } from "../pool-mode";

export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_STATS_SCHEMA = 3;

/** "close" (position only): same unit — back three/centres, halves, or forwards. */
export type WordleClueTone = "match" | "close" | "miss";
export type WordleTrend = "higher" | "lower" | "match";

export type WordleAttributeKey =
  | "nationality"
  | "position"
  | "club"
  | "rating"
  | "age"
  | "status";

export type WordleClues = {
  nationality: WordleClueTone;
  position: WordleClueTone;
  club: WordleClueTone;
  rating: WordleTrend;
  age: WordleTrend;
  /** Historic vs current pool match. */
  status: WordleClueTone;
  /**
   * Decade of the card season (v1.18): match, or which way the answer's decade lies. Only shown
   * in Era Wordle (every Current card is the same season). Missing on older saved guesses.
   */
  era?: WordleTrend;
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
  age: number;
  isHistoric: boolean;
  /** Decade label of the card season, e.g. "1990s" (Era Wordle feedback). */
  eraLabel?: string;
  clues: WordleClues;
};

export type WordleStatus = "playing" | "won" | "lost";

export type WordleRun = {
  /** Unique run id (not a calendar day). */
  date: string;
  answerId: string;
  guesses: WordleGuess[];
  discoveredClues: WordleDiscoveredClue[];
  /** True after the optional one-time attribute reveal is used. */
  hintUsed: boolean;
  answerHint: WordleAnswerHint | null;
  status: WordleStatus;
  rewardClaimed: boolean;
  /** Current vs Era pool for this run. */
  poolMode?: MiniGamePoolMode;
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
  age: "AGE",
  status: "STATUS",
};

export function wordleStatusLabel(isHistoric: boolean): string {
  return isHistoric ? "Historic" : "Current";
}
