import {
  addClubFundsMarkers,
  awardClubFundsLines,
  getClubFundsBalance,
  getPaidRunIds,
} from "@/lib/storage/club-funds";
import { getLocalDateKey } from "@/lib/mini-games/date";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { markRewardClaimed } from "./engine";
import { QUIZ_GAME_NAME, QUIZ_TOP_PRIZE } from "./prizes";
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

/**
 * Golden Point Quiz economy (v1.18):
 * - the day's first finished run pays its prize in full (top prize £100,000);
 * - every later run that day pays 10% of its prize (diminishing returns: the bank can be learned);
 * - the quiz never pays more than `QUIZ_DAILY_CAP` in one UK day.
 * So the most the quiz can pay in a day is £100k, below a strong Classic season (~£213k).
 */
export const QUIZ_REPEAT_RUN_SHARE = 0.1;
export const QUIZ_DAILY_CAP = QUIZ_TOP_PRIZE;

/** v1.17 marker: best prize banked that day (one per paid run). Read as earlier runs. */
const LEGACY_BEST_PREFIX = "quiz_best:";
/** v1.18 marker: one per finished run, `quiz_day:<date>:<paid>:<runId>`. */
const DAY_RUN_PREFIX = "quiz_day:";

export function quizDayRunMarkerId(date: string, paid: number, runId: string): string {
  return `${DAY_RUN_PREFIX}${date}:${Math.max(0, Math.round(paid))}:${runId}`;
}

export interface QuizDayLedger {
  /** Finished runs already recorded today. */
  runs: number;
  /** Club Funds the quiz has paid today. */
  paid: number;
}

/** Runs and payouts recorded for the quiz on a UK day (synced via the Club Funds ledger). */
export function getQuizDayLedger(date = getLocalDateKey()): QuizDayLedger {
  const dayPrefix = `${DAY_RUN_PREFIX}${date}:`;
  const legacyPrefix = `${LEGACY_BEST_PREFIX}${date}:`;
  let runs = 0;
  let paid = 0;
  let legacyBest = 0;
  for (const id of getPaidRunIds()) {
    if (id.startsWith(dayPrefix)) {
      const amount = Number(id.slice(dayPrefix.length).split(":")[0]);
      runs += 1;
      if (Number.isFinite(amount) && amount > 0) paid += amount;
    } else if (id.startsWith(legacyPrefix)) {
      const amount = Number(id.slice(legacyPrefix.length));
      if (Number.isFinite(amount) && amount > legacyBest) legacyBest = amount;
    }
  }
  // Pre-v1.18 runs on the same day: the old top-up rule paid exactly the day's best in total.
  if (legacyBest > 0) {
    runs += 1;
    paid += legacyBest;
  }
  return { runs, paid };
}

/** True once today's full-price run has been played. */
export function hasPlayedQuizFullRunToday(date = getLocalDateKey()): boolean {
  return getQuizDayLedger(date).runs > 0;
}

/** What a run reaching `prize` would bank right now. */
export function getQuizPayoutForPrize(prize: number, date = getLocalDateKey()): number {
  const safePrize = Math.max(0, Math.round(prize));
  if (safePrize <= 0) return 0;
  const { runs, paid } = getQuizDayLedger(date);
  const roomLeft = Math.max(0, QUIZ_DAILY_CAP - paid);
  const base = runs === 0 ? safePrize : Math.round((safePrize * QUIZ_REPEAT_RUN_SHARE) / 10) * 10;
  return Math.max(0, Math.min(base, roomLeft));
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
    if (!run.rewardClaimed && run.mode === "millionaire") {
      // A £0 run still uses up today's full-price run (no free rerolls by failing early).
      const date = getLocalDateKey();
      if (!getPaidRunIds().some((id) => id.startsWith(DAY_RUN_PREFIX) && id.endsWith(`:${run.id}`))) {
        addClubFundsMarkers([quizDayRunMarkerId(date, 0, run.id)]);
      }
    }
    return {
      run: run.rewardClaimed ? run : { ...markRewardClaimed(run, run.rewardAmount), rewardPaid: 0 },
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
    const firstRun = !hasPlayedQuizFullRunToday(date);
    const amount = getQuizPayoutForPrize(run.rewardAmount, date);
    if (amount <= 0) {
      addClubFundsMarkers([quizDayRunMarkerId(date, 0, run.id), runId]);
      const next: QuizRun = { ...markRewardClaimed(run, run.rewardAmount), rewardPaid: 0 };
      saveQuizRun(next);
      return { run: next, payout: unpaid(runId) };
    }
    const payout = awardClubFundsLines(
      runId,
      [
        {
          id: "quiz-reward",
          label: firstRun ? `${QUIZ_GAME_NAME} reward` : `${QUIZ_GAME_NAME} (repeat run, 10%)`,
          amount,
        },
      ],
      [quizDayRunMarkerId(date, amount, run.id)]
    );
    const next: QuizRun = {
      ...markRewardClaimed(run, run.rewardAmount),
      rewardPaid: payout.awarded ? amount : 0,
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
