import { awardClubFundsLines } from "@/lib/storage/club-funds";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { markRewardClaimed } from "./engine";
import { saveQuizRun } from "./storage";
import type { QuizRun } from "./types";

export function quizRewardRunId(runId: string): string {
  return `quiz_reward:${runId}`;
}

export function claimQuizReward(run: QuizRun): {
  run: QuizRun;
  payout: ClubFundsPayoutResult;
} {
  const runId = quizRewardRunId(run.id);
  if (run.rewardClaimed || run.rewardAmount <= 0) {
    return {
      run: run.rewardClaimed ? run : markRewardClaimed(run, run.rewardAmount),
      payout: {
        runId,
        lines: [],
        total: run.rewardAmount,
        awarded: false,
        newBalance: 0,
      },
    };
  }

  const payout = awardClubFundsLines(runId, [
    {
      id: "quiz-reward",
      label:
        run.mode === "team"
          ? "Team Challenge reward"
          : "Super League Millionaire reward",
      amount: run.rewardAmount,
    },
  ]);

  const next = markRewardClaimed(run, run.rewardAmount);
  saveQuizRun(next);
  return { run: next, payout };
}
