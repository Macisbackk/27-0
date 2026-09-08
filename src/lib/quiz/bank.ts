import { CURATED_QUIZ_QUESTIONS } from "../../../data/quiz/curated";
import generatedBank from "../../../data/quiz/generated/bank.json";
import { assertValidQuestionBank } from "./validate";
import type { QuizQuestion, QuizTeamId } from "./types";

let cached: QuizQuestion[] | null = null;

function asQuestions(value: unknown): QuizQuestion[] {
  if (!Array.isArray(value)) return [];
  return value as QuizQuestion[];
}

export function getQuizQuestionBank(): QuizQuestion[] {
  if (cached) return cached;
  const generated = asQuestions(generatedBank);
  const merged = [...CURATED_QUIZ_QUESTIONS, ...generated];
  const seen = new Set<string>();
  const seenTopics = new Set<string>();
  const unique: QuizQuestion[] = [];
  for (const question of merged) {
    if (
      !question?.id ||
      !question.topicId ||
      seen.has(question.id) ||
      seenTopics.has(question.topicId)
    ) {
      continue;
    }
    seen.add(question.id);
    seenTopics.add(question.topicId);
    unique.push(question);
  }
  assertValidQuestionBank(unique);
  cached = unique;
  return unique;
}

export function getTeamQuestionCount(
  bank: readonly QuizQuestion[],
  teamId: QuizTeamId
): number {
  return bank.filter((question) => question.teams.includes(teamId)).length;
}

export function summarizeQuestionBank(bank: readonly QuizQuestion[]): {
  total: number;
  general: number;
  byTeam: Record<QuizTeamId, number>;
  byDifficulty: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  topics: number;
} {
  const byTeam = {} as Record<QuizTeamId, number>;
  const byDifficulty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const topics = new Set<string>();
  for (const question of bank) {
    byDifficulty[question.difficulty] = (byDifficulty[question.difficulty] ?? 0) + 1;
    byCategory[question.category] = (byCategory[question.category] ?? 0) + 1;
    bySource[question.sourceType] = (bySource[question.sourceType] ?? 0) + 1;
    topics.add(question.topicId);
    for (const team of question.teams) {
      byTeam[team] = (byTeam[team] ?? 0) + 1;
    }
  }
  return {
    total: bank.length,
    general: bank.length,
    byTeam,
    byDifficulty,
    byCategory,
    bySource,
    topics: topics.size,
  };
}
