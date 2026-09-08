import { getQuestionById, isTerminalQuizPhase } from "./engine";
import { QUIZ_RECENT_QUESTION_LIMIT } from "./types";
import type { QuizQuestion, QuizRun, QuizStats, QuizTeamStats } from "./types";
import {
  bumpCategoryAccuracy,
  getTeamStats,
  loadQuizStats,
  saveQuizStats,
} from "./storage";

function countLifelinesUsed(run: QuizRun): number {
  return (
    Number(run.lifelines.fiftyFifty) +
    Number(run.lifelines.crowd) +
    Number(run.lifelines.phone) +
    Number(run.lifelines.change)
  );
}

export function recordCompletedQuizRun(
  run: QuizRun,
  bank: readonly QuizQuestion[]
): QuizStats {
  const stats = loadQuizStats();
  if (!isTerminalQuizPhase(run.phase)) return stats;
  if (stats.recordedRunIds.includes(run.id)) return stats;
  stats.recordedRunIds = [...stats.recordedRunIds, run.id].slice(-200);

  const correct = run.questions.filter((question) => question.correct === true).length;
  const incorrect = run.questions.filter((question) => question.correct === false).length;
  const reached = correct + incorrect;
  const perfect = run.phase === "quiz_complete" && correct === 15;
  const millionaire = run.phase === "quiz_complete";

  stats.quizzesPlayed += 1;
  if (run.mode === "millionaire") stats.millionairePlayed += 1;
  if (run.mode === "team") stats.teamChallengePlayed += 1;
  stats.highestPrize = Math.max(stats.highestPrize, run.rewardAmount);
  stats.totalWinnings += run.rewardAmount;
  stats.questionsCorrect += correct;
  stats.questionsIncorrect += incorrect;
  stats.longestRun = Math.max(stats.longestRun, correct);
  if (perfect) stats.perfectRuns += 1;
  stats.lifelinesUsed += countLifelinesUsed(run);

  for (const slot of run.questions) {
    if (slot.correct === null) continue;
    const question = getQuestionById(bank, slot.questionId);
    if (!question) continue;
    bumpCategoryAccuracy(stats, question.category, slot.correct);
  }

  const recent = [
    ...run.questions.map((question) => question.questionId),
    ...stats.recentQuestionIds,
  ];
  stats.recentQuestionIds = [...new Set(recent)].slice(0, QUIZ_RECENT_QUESTION_LIMIT);
  const recentTopics = [
    ...run.questions
      .map((slot) => getQuestionById(bank, slot.questionId)?.topicId)
      .filter((topicId): topicId is string => Boolean(topicId)),
    ...stats.recentTopicIds,
  ];
  stats.recentTopicIds = [...new Set(recentTopics)].slice(
    0,
    QUIZ_RECENT_QUESTION_LIMIT
  );

  if (run.mode === "team" && run.teamId) {
    const team: QuizTeamStats = { ...getTeamStats(stats, run.teamId) };
    team.highestPrize = Math.max(team.highestPrize, run.rewardAmount);
    team.questionsAnswered += correct + incorrect;
    team.bestQuestionReached = Math.max(team.bestQuestionReached, reached);
    team.totalMoneyEarned += run.rewardAmount;
    if (millionaire) {
      team.completions += 1;
      team.millionaireRuns += 1;
    }
    if (perfect) team.perfectRuns += 1;
    stats.teamStats[run.teamId] = team;
  }

  saveQuizStats(stats);
  return stats;
}

export function getQuizStatsSnapshot(): QuizStats {
  return loadQuizStats();
}
