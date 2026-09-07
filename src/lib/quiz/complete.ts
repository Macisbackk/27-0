import { triggerQuizAchievements } from "@/lib/achievements/achievementTriggers";
import { getUsername } from "@/lib/storage/user";
import { syncQuizLeaderboard } from "@/lib/storage/quiz-leaderboard";
import { countCorrectAnswers, isTerminalQuizPhase } from "./engine";
import { getCurrentPrize } from "./prizes";
import { claimQuizReward } from "./rewards";
import { recordCompletedQuizRun } from "./stats";
import { saveQuizRun } from "./storage";
import type { QuizQuestion, QuizRun } from "./types";

export function settleCompletedQuizRun(
  run: QuizRun,
  bank: readonly QuizQuestion[]
): QuizRun {
  if (!isTerminalQuizPhase(run.phase)) return run;

  const { run: paid } = claimQuizReward(run);
  const stats = recordCompletedQuizRun(paid, bank);
  saveQuizRun(paid);

  const correct = countCorrectAnswers(paid);
  const answered = paid.questions.filter((question) => question.correct !== null).length;
  const lifelinesUsed =
    Number(paid.lifelines.fiftyFifty) +
    Number(paid.lifelines.crowd) +
    Number(paid.lifelines.phone) +
    Number(paid.lifelines.change);
  const prizeReached = Math.max(paid.rewardAmount, getCurrentPrize(correct));
  const perfect = paid.phase === "quiz_complete" && correct === 15;

  triggerQuizAchievements({
    questionsAnswered: Math.max(answered, stats.questionsCorrect + stats.questionsIncorrect),
    questionsCorrect: stats.questionsCorrect,
    highestPrize: Math.max(prizeReached, stats.highestPrize),
    perfectRun: perfect,
    noLifelines: perfect && lifelinesUsed === 0,
    teamCompleted: paid.mode === "team" && paid.phase === "quiz_complete",
    teamMillionaire: paid.mode === "team" && perfect,
  });

  if (getUsername()) {
    syncQuizLeaderboard({
      highestPrize: stats.highestPrize,
      millionaireRuns: stats.perfectRuns,
      questionsCorrect: stats.questionsCorrect,
    });
  }

  return paid;
}
