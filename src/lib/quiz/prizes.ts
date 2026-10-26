import { QUIZ_QUESTION_COUNT } from "./types";

/** Player-facing name of the 15-question quiz (it was "Super League Millionaire" before v1.18). */
export const QUIZ_GAME_NAME = "Golden Point Quiz";

/**
 * Club Funds prize ladder; Q15 (all correct) pays £100,000.
 *
 * v1.18 economy: the ladder used to top out at £1,000,000 a day from a learnable 709-question
 * bank, five times a strong Classic season (~£213k). The top prize is now £100k, so a good
 * Classic run stays the best earner, and only the day's first finished run pays in full (see
 * `rewards.ts`).
 */
export const QUIZ_PRIZE_LADDER = [
  100, 250, 500, 1_000, 2_000, 3_000, 5_000, 7_500, 10_000, 15_000, 25_000,
  35_000, 50_000, 75_000, 100_000,
] as const;

/** Top of the ladder (all 15 correct). */
export const QUIZ_TOP_PRIZE: number = QUIZ_PRIZE_LADDER[QUIZ_PRIZE_LADDER.length - 1];

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

/** Last safe-haven prize reached (0 before Q5, £2,000 after Q5, £15,000 after Q10). */
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
