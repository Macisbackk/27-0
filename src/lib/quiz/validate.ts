import { QUIZ_CLUBS } from "./clubs";
import {
  QUIZ_CATEGORIES,
  QUIZ_DIFFICULTIES,
  QUIZ_SOURCE_TYPES,
  QUIZ_TEAM_IDS,
  type QuizQuestion,
  type QuizTeamId,
} from "./types";

export interface QuizValidationIssue {
  id: string;
  message: string;
}

const TEAM_ID_SET = new Set<string>(QUIZ_TEAM_IDS);
const DIFFICULTY_SET = new Set<string>(QUIZ_DIFFICULTIES);
const CATEGORY_SET = new Set<string>(QUIZ_CATEGORIES);
const SOURCE_SET = new Set<string>(QUIZ_SOURCE_TYPES);
const CLUB_ID_SET = new Set(QUIZ_CLUBS.map((club) => club.id));

function uniqueStrings(values: string[]): boolean {
  return new Set(values.map((value) => value.trim().toLowerCase())).size === values.length;
}

export function normalizeQuestionStem(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeQuestionStem(value).split(" ").filter(Boolean));
}

export function stemSimilarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

export function validateQuestion(question: QuizQuestion): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];
  const prefix = question.id || "(missing-id)";

  if (!question.id?.trim()) {
    issues.push({ id: prefix, message: "Missing question id" });
  }
  if (!question.topicId?.trim()) {
    issues.push({ id: prefix, message: "Missing topicId" });
  }
  if (!question.question?.trim()) {
    issues.push({ id: prefix, message: "Missing question text" });
  }
  if (/27-0/i.test(question.question ?? "")) {
    issues.push({ id: prefix, message: "Question text mentions 27-0" });
  }
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    issues.push({ id: prefix, message: "Must have exactly four options" });
  } else {
    if (question.options.some((option) => !option?.trim())) {
      issues.push({ id: prefix, message: "An option is empty" });
    }
    if (!uniqueStrings(question.options)) {
      issues.push({ id: prefix, message: "Duplicate options" });
    }
  }
  if (!question.correctAnswer?.trim()) {
    issues.push({ id: prefix, message: "Missing correct answer" });
  } else if (
    Array.isArray(question.options) &&
    question.options.filter((option) => option === question.correctAnswer).length !== 1
  ) {
    issues.push({
      id: prefix,
      message: "correctAnswer must match exactly one option",
    });
  }
  if (!DIFFICULTY_SET.has(question.difficulty)) {
    issues.push({ id: prefix, message: `Invalid difficulty: ${question.difficulty}` });
  }
  if (!CATEGORY_SET.has(question.category)) {
    issues.push({ id: prefix, message: `Invalid category: ${question.category}` });
  }
  if (!SOURCE_SET.has(question.sourceType)) {
    issues.push({ id: prefix, message: `Invalid sourceType: ${question.sourceType}` });
  }
  if (!Array.isArray(question.teams)) {
    issues.push({ id: prefix, message: "teams must be an array" });
  } else {
    for (const team of question.teams) {
      if (!TEAM_ID_SET.has(team) || !CLUB_ID_SET.has(team as QuizTeamId)) {
        issues.push({ id: prefix, message: `Unknown team id: ${team}` });
      }
    }
  }
  return issues;
}

/** Fast structural validation for runtime bank load. */
export function validateQuestionBank(questions: QuizQuestion[]): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenTopics = new Set<string>();
  const seenStems = new Map<string, string>();

  for (const question of questions) {
    if (seenIds.has(question.id)) {
      issues.push({ id: question.id, message: "Duplicate question id" });
    }
    seenIds.add(question.id);

    if (question.topicId) {
      if (seenTopics.has(question.topicId)) {
        issues.push({
          id: question.id,
          message: `Duplicate topicId: ${question.topicId}`,
        });
      }
      seenTopics.add(question.topicId);
    }

    const stem = normalizeQuestionStem(question.question ?? "");
    const existingStem = seenStems.get(stem);
    if (existingStem) {
      issues.push({
        id: question.id,
        message: `Duplicate normalized stem (same as ${existingStem})`,
      });
    } else if (stem) {
      seenStems.set(stem, question.id);
    }

    issues.push(...validateQuestion(question));
  }

  return issues;
}

/** Slower similarity audit for CLI tooling only. */
export function auditSimilarQuestions(
  questions: QuizQuestion[]
): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];
  for (let i = 0; i < questions.length; i++) {
    const left = questions[i];
    if (!left) continue;
    for (let j = i + 1; j < questions.length; j++) {
      const right = questions[j];
      if (!right) continue;
      if (left.topicId === right.topicId) continue;
      if (stemSimilarity(left.question, right.question) >= 0.92) {
        issues.push({
          id: left.id,
          message: `Highly similar to ${right.id}`,
        });
      }
    }
  }
  return issues;
}

export function assertValidQuestionBank(questions: QuizQuestion[]): void {
  const issues = validateQuestionBank(questions);
  if (issues.length > 0) {
    const preview = issues
      .slice(0, 12)
      .map((issue) => `${issue.id}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Quiz question bank failed validation (${issues.length} issues).\n${preview}`
    );
  }
}
