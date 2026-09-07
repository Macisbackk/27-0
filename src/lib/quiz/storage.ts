import { STORAGE_KEYS } from "@/lib/storage/keys";
import {
  QUIZ_SCHEMA_VERSION,
  QUIZ_STATS_SCHEMA_VERSION,
  QUIZ_TEAM_IDS,
} from "./types";
import type {
  QuizCategory,
  QuizRun,
  QuizStats,
  QuizTeamId,
  QuizTeamStats,
} from "./types";

const emptyTeamStats = (): QuizTeamStats => ({
  highestPrize: 0,
  questionsAnswered: 0,
  bestQuestionReached: 0,
  completions: 0,
  millionaireRuns: 0,
  totalMoneyEarned: 0,
  perfectRuns: 0,
});

export function createEmptyQuizStats(): QuizStats {
  return {
    schemaVersion: QUIZ_STATS_SCHEMA_VERSION,
    quizzesPlayed: 0,
    millionairePlayed: 0,
    teamChallengePlayed: 0,
    highestPrize: 0,
    totalWinnings: 0,
    questionsCorrect: 0,
    questionsIncorrect: 0,
    longestRun: 0,
    perfectRuns: 0,
    lifelinesUsed: 0,
    categoryAccuracy: {},
    teamStats: {},
    recentQuestionIds: [],
    recordedRunIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — keep the in-memory run going.
  }
}

function isStoredQuizRun(value: Record<string, unknown>): boolean {
  const validPhases = new Set([
    "question_active",
    "answer_locked",
    "answer_revealed",
    "quiz_complete",
    "quiz_failed",
    "quiz_walked_away",
  ]);
  const validTeamIds = new Set<string>(QUIZ_TEAM_IDS);
  if (value.schemaVersion !== QUIZ_SCHEMA_VERSION) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (value.mode !== "millionaire" && value.mode !== "team") return false;
  if (value.mode === "team" && !validTeamIds.has(String(value.teamId))) {
    return false;
  }
  if (!validPhases.has(String(value.phase))) return false;
  if (
    typeof value.questionIndex !== "number" ||
    value.questionIndex < 0 ||
    value.questionIndex > 14
  ) {
    return false;
  }
  if (!Array.isArray(value.questions) || value.questions.length !== 15) {
    return false;
  }
  if (
    value.questions.some(
      (slot) =>
        !isRecord(slot) ||
        typeof slot.questionId !== "string" ||
        !Array.isArray(slot.optionOrder) ||
        slot.optionOrder.length !== 4 ||
        slot.optionOrder.some(
          (option) =>
            typeof option !== "number" || option < 0 || option > 3
        ) ||
        new Set(slot.optionOrder).size !== 4 ||
        !Array.isArray(slot.hiddenOptionIndexes)
    )
  ) {
    return false;
  }
  const lifelines = value.lifelines;
  if (!isRecord(lifelines)) return false;
  return ["fiftyFifty", "crowd", "phone", "change"].every(
    (key) => typeof lifelines[key] === "boolean"
  );
}

export function loadQuizRun(): QuizRun | null {
  const parsed = readJson(STORAGE_KEYS.quizRun);
  if (!isRecord(parsed)) return null;
  return isStoredQuizRun(parsed) ? (parsed as unknown as QuizRun) : null;
}

export function saveQuizRun(run: QuizRun | null): void {
  if (typeof window === "undefined") return;
  if (!run) {
    try {
      localStorage.removeItem(STORAGE_KEYS.quizRun);
    } catch {
      // ignore
    }
    return;
  }
  writeJson(STORAGE_KEYS.quizRun, run);
}

export function clearQuizRun(): void {
  saveQuizRun(null);
}

export function loadQuizStats(): QuizStats {
  const parsed = readJson(STORAGE_KEYS.quizStats);
  if (!isRecord(parsed) || parsed.schemaVersion !== QUIZ_STATS_SCHEMA_VERSION) {
    return createEmptyQuizStats();
  }
  return {
    ...createEmptyQuizStats(),
    ...(parsed as unknown as QuizStats),
    schemaVersion: QUIZ_STATS_SCHEMA_VERSION,
  };
}

export function saveQuizStats(stats: QuizStats): void {
  writeJson(STORAGE_KEYS.quizStats, stats);
}

export function getTeamStats(stats: QuizStats, teamId: QuizTeamId): QuizTeamStats {
  return stats.teamStats[teamId] ?? emptyTeamStats();
}

export function bumpCategoryAccuracy(
  stats: QuizStats,
  category: QuizCategory,
  correct: boolean
): void {
  const current = stats.categoryAccuracy[category] ?? { correct: 0, answered: 0 };
  stats.categoryAccuracy[category] = {
    correct: current.correct + (correct ? 1 : 0),
    answered: current.answered + 1,
  };
}
