export const QUIZ_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
  "very-hard",
  "expert",
] as const;
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

export const QUIZ_CATEGORIES = [
  "history",
  "players",
  "clubs",
  "coaches",
  "stadiums",
  "grand-finals",
  "challenge-cup",
  "records",
  "seasons",
  "statistics",
  "famous-matches",
  "transfers",
  "captains",
  "general",
] as const;
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

export const QUIZ_SOURCE_TYPES = [
  "curated",
  "finals",
  "starting-17",
  "roster",
  "records",
  "honours",
] as const;
export type QuizSourceType = (typeof QUIZ_SOURCE_TYPES)[number];

export const QUIZ_TEAM_IDS = [
  "bradford",
  "castleford",
  "catalans",
  "huddersfield",
  "hull-fc",
  "hull-kr",
  "leeds",
  "leigh",
  "london",
  "salford",
  "st-helens",
  "toulouse",
  "wakefield",
  "warrington",
  "widnes",
  "wigan",
  "york",
] as const;
export type QuizTeamId = (typeof QUIZ_TEAM_IDS)[number];

export type QuizMode = "millionaire" | "team";

export type QuizPhase =
  | "idle"
  | "selecting_mode"
  | "selecting_team"
  | "question_active"
  | "answer_locked"
  | "answer_revealed"
  | "quiz_complete"
  | "quiz_failed"
  | "quiz_walked_away";

export interface QuizQuestion {
  id: string;
  /** Stable identifier for the underlying fact, independent of wording. */
  topicId: string;
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
  difficulty: QuizDifficulty;
  category: QuizCategory;
  /** Club IDs this question is about — not merely clubs that appear as answers. */
  teams: QuizTeamId[];
  era?: string;
  sourceType: QuizSourceType;
  /** Team Challenge should use objective facts only. */
  answerType?: "objective" | "subjective";
}

export interface QuizLifelineState {
  fiftyFifty: boolean;
  crowd: boolean;
  phone: boolean;
  change: boolean;
}

export interface QuizCrowdResult {
  percents: [number, number, number, number];
}

export interface QuizPhoneResult {
  suggestionIndex: number;
  confidence: "high" | "medium" | "low";
  quote: string;
}

export interface QuizRunQuestion {
  questionId: string;
  optionOrder: [number, number, number, number];
  hiddenOptionIndexes: number[];
  selectedDisplayIndex: number | null;
  correct: boolean | null;
  crowd: QuizCrowdResult | null;
  phone: QuizPhoneResult | null;
}

export interface QuizRun {
  schemaVersion: number;
  id: string;
  mode: QuizMode;
  teamId: QuizTeamId | null;
  phase: QuizPhase;
  questionIndex: number;
  questions: QuizRunQuestion[];
  lifelines: QuizLifelineState;
  rewardClaimed: boolean;
  rewardAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizTeamStats {
  highestPrize: number;
  questionsAnswered: number;
  bestQuestionReached: number;
  completions: number;
  millionaireRuns: number;
  totalMoneyEarned: number;
  perfectRuns: number;
}

export interface QuizCategoryAccuracy {
  correct: number;
  answered: number;
}

export interface QuizStats {
  schemaVersion: number;
  quizzesPlayed: number;
  millionairePlayed: number;
  teamChallengePlayed: number;
  highestPrize: number;
  totalWinnings: number;
  questionsCorrect: number;
  questionsIncorrect: number;
  longestRun: number;
  perfectRuns: number;
  lifelinesUsed: number;
  categoryAccuracy: Partial<Record<QuizCategory, QuizCategoryAccuracy>>;
  teamStats: Partial<Record<QuizTeamId, QuizTeamStats>>;
  recentQuestionIds: string[];
  recentTopicIds: string[];
  recordedRunIds: string[];
}

export const QUIZ_SCHEMA_VERSION = 1;
export const QUIZ_STATS_SCHEMA_VERSION = 2;
export const QUIZ_QUESTION_COUNT = 15;
export const QUIZ_RECENT_QUESTION_LIMIT = 80;
