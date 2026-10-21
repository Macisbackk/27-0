import { awardClubFundsLines, getPaidRunIds } from "@/lib/storage/club-funds";
import { getLocalDateKey } from "@/lib/mini-games/date";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { markRewardClaimed } from "./engine";
import { saveQuizRun } from "./storage";
import type { QuizRun } from "./types";

export function quizRewardRunId(runId: string): string {
  return `quiz_reward:${runId}`;
}

/** One paid Team Challenge per club per UK day. */
export function teamChallengeRewardId(teamId: string, date = getLocalDateKey()): string {
  return `quiz_team:${teamId}:${date}`;
}

export function isTeamChallengeRewardBankedToday(teamId: string): boolean {
  return getPaidRunIds().includes(teamChallengeRewardId(teamId));
}

export function claimQuizReward(run: QuizRun): {
  run: QuizRun;
  payout: ClubFundsPayoutResult;
} {
  const runId =
    run.mode === "team" && run.teamId ? teamChallengeRewardId(run.teamId) : quizRewardRunId(run.id);
  if (!run.rewardClaimed && run.rewardAmount > 0 && run.mode === "team" && getPaidRunIds().includes(runId)) {
    const practice = { ...markRewardClaimed(run, 0), rewardPractice: true };
    saveQuizRun(practice);
    return {
      run: practice,
      payout: { runId, lines: [], total: 0, awarded: false, newBalance: 0 },
    };
  }
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
