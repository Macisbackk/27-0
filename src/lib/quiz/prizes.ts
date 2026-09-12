import { QUIZ_QUESTION_COUNT } from "./types";

/** Club Funds prize ladder — scaled under season title (£200k) so quiz does not outpace Quick Mode. */
export const QUIZ_PRIZE_LADDER = [
  50, 100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 12_000, 20_000, 35_000,
  50_000, 75_000, 100_000,
] as const;

export const QUIZ_SAFE_QUESTION_NUMBERS = [5, 10] as const;

export function getPrizeForQuestionNumber(questionNumber: number): number {
  if (questionNumber < 1 || questionNumber > QUIZ_QUESTION_COUNT) return 0;
  return QUIZ_PRIZE_LADDER[questionNumber - 1] ?? 0;
}

/** Prize already banked after answering `correctCount` questions correctly. */
export function getCurrentPrize(correctCount: number): number {
  if (correctCount <= 0) return 0;
  return getPrizeForQuestionNumber(Math.min(correctCount, QUIZ_QUESTION_COUNT));
}

export function getNextPrize(correctCount: number): number | null {
  if (correctCount >= QUIZ_QUESTION_COUNT) return null;
  return getPrizeForQuestionNumber(correctCount + 1);
}

/** Last safe-haven prize reached (0 before Q5, £500 after Q5, £12,000 after Q10). */
export function getGuaranteedPrize(correctCount: number): number {
  if (correctCount >= 10) return getPrizeForQuestionNumber(10);
  if (correctCount >= 5) return getPrizeForQuestionNumber(5);
  return 0;
}

export function isSafeQuestionNumber(questionNumber: number): boolean {
  return (QUIZ_SAFE_QUESTION_NUMBERS as readonly number[]).includes(
    questionNumber
  );
}

/** Wrong answer: drop to the last safe haven. */
export function getWrongAnswerPayout(correctCount: number): number {
  return getGuaranteedPrize(correctCount);
}

/** Walk away: take the last correctly answered prize, never the unanswered next prize. */
export function getWalkAwayPayout(correctCount: number): number {
  return getCurrentPrize(correctCount);
}

export function getCompletionPayout(): number {
  return getPrizeForQuestionNumber(QUIZ_QUESTION_COUNT);
}

export type QuizEndReason = "complete" | "failed" | "walked_away";

export function getEndPayout(
  reason: QuizEndReason,
  correctCount: number
): number {
  if (reason === "complete") return getCompletionPayout();
  if (reason === "walked_away") return getWalkAwayPayout(correctCount);
  return getWrongAnswerPayout(correctCount);
}
