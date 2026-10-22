import {
  awardClubFundsLines,
  getClubFundsBalance,
  getPaidRunIds,
} from "@/lib/storage/club-funds";
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

const MILLIONAIRE_BEST_PREFIX = "quiz_best:";

/**
 * Ledger marker for the best Super League Millionaire prize banked on a UK day. Saved with the
 * payout so it syncs across devices.
 */
export function millionaireDayBestMarkerId(date: string, prize: number): string {
  return `${MILLIONAIRE_BEST_PREFIX}${date}:${Math.max(0, Math.round(prize))}`;
}

/** Best Super League Millionaire prize already banked today (0 if none). */
export function getMillionaireBankedToday(date = getLocalDateKey()): number {
  const prefix = `${MILLIONAIRE_BEST_PREFIX}${date}:`;
  let best = 0;
  for (const id of getPaidRunIds()) {
    if (!id.startsWith(prefix)) continue;
    const amount = Number(id.slice(prefix.length));
    if (Number.isFinite(amount) && amount > best) best = amount;
  }
  return best;
}

/**
 * Super League Millionaire pays your best run of the UK day: the first run banks its prize and
 * later runs bank only what they add on top of today's best, so the £1,000,000 top prize can be
 * won at most once a day (it was unlimited, and the 709-question bank can be learned).
 */
export function getMillionaireTopUp(prize: number, date = getLocalDateKey()): number {
  return Math.max(0, prize - getMillionaireBankedToday(date));
}

function unpaid(runId: string): ClubFundsPayoutResult {
  return { runId, lines: [], total: 0, awarded: false, newBalance: getClubFundsBalance() };
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

  if (run.mode === "millionaire") {
    // A run already paid (e.g. reopened before the claimed flag was saved) never pays twice.
    if (getPaidRunIds().includes(runId)) {
      const next = markRewardClaimed(run, run.rewardAmount);
      saveQuizRun(next);
      return { run: next, payout: unpaid(runId) };
    }
    const date = getLocalDateKey();
    const topUp = getMillionaireTopUp(run.rewardAmount, date);
    if (topUp <= 0) {
      const next: QuizRun = { ...markRewardClaimed(run, run.rewardAmount), rewardPaid: 0 };
      saveQuizRun(next);
      return { run: next, payout: unpaid(runId) };
    }
    const payout = awardClubFundsLines(
      runId,
      [
        {
          id: "quiz-reward",
          label:
            topUp < run.rewardAmount
              ? "Super League Millionaire (beat today's best)"
              : "Super League Millionaire reward",
          amount: topUp,
        },
      ],
      [millionaireDayBestMarkerId(date, run.rewardAmount)]
    );
    const next: QuizRun = {
      ...markRewardClaimed(run, run.rewardAmount),
      rewardPaid: payout.awarded ? topUp : 0,
    };
    saveQuizRun(next);
    return { run: next, payout };
  }

  const payout = awardClubFundsLines(runId, [
    {
      id: "quiz-reward",
      label: "Team Challenge reward",
      amount: run.rewardAmount,
    },
  ]);

  const next = markRewardClaimed(run, run.rewardAmount);
  saveQuizRun(next);
  return { run: next, payout };
}
