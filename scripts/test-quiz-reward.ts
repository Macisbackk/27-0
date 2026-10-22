/**
 * Quiz reward idempotency test.
 * Run: npx tsx scripts/test-quiz-reward.ts
 */
import type { QuizRun } from "../src/lib/quiz/types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const windowTarget = new EventTarget();
Object.assign(globalThis, {
  window: windowTarget,
  localStorage: new MemoryStorage(),
});

if (typeof globalThis.CustomEvent === "undefined") {
  class NodeCustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail as T;
    }
  }
  Object.assign(globalThis, { CustomEvent: NodeCustomEvent });
}

async function main(): Promise<void> {
  const { getClubFundsBalance } = await import(
    "../src/lib/storage/club-funds"
  );
  const { claimQuizReward, quizRewardRunId } = await import(
    "../src/lib/quiz/rewards"
  );
  const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
  const { loadQuizRun } = await import("../src/lib/quiz/storage");

  const run: QuizRun = {
  schemaVersion: 1,
  id: "reward-idempotency-test",
  mode: "millionaire",
  teamId: null,
  phase: "quiz_failed",
  questionIndex: 5,
  questions: [],
  lifelines: {
    fiftyFifty: false,
    crowd: false,
    phone: false,
    change: false,
  },
  rewardClaimed: false,
  rewardAmount: 1_000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  };

  const before = getClubFundsBalance();
  const first = claimQuizReward(run);
  const afterFirst = getClubFundsBalance();
  const reopenedWithoutClaimFlag = { ...run, rewardClaimed: false };
  const second = claimQuizReward(reopenedWithoutClaimFlag);
  const afterSecond = getClubFundsBalance();

  const state = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.clubFunds) ?? "{}"
  ) as { paidRunIds?: string[] };
  const paymentId = quizRewardRunId(run.id);
  const paymentIdCount = (state.paidRunIds ?? []).filter(
    (id) => id === paymentId
  ).length;

  // Millionaire pays the day's best run: lower runs bank nothing, higher runs bank the difference.
  const { getMillionaireBankedToday } = await import("../src/lib/quiz/rewards");
  const bestAfterFirst = getMillionaireBankedToday();
  const lower = claimQuizReward({ ...run, id: "reward-lower-run", rewardAmount: 500 });
  const afterLower = getClubFundsBalance();
  const higher = claimQuizReward({ ...run, id: "reward-higher-run", rewardAmount: 4_000 });
  const afterHigher = getClubFundsBalance();
  const higherAgain = claimQuizReward({ ...run, id: "reward-higher-run", rewardAmount: 4_000 });
  const afterHigherAgain = getClubFundsBalance();
  const bestAfterHigher = getMillionaireBankedToday();
  localStorage.setItem(
    STORAGE_KEYS.quizRun,
    JSON.stringify({
      schemaVersion: 1,
      id: "corrupt",
      mode: "millionaire",
      phase: "question_active",
      questions: "not-an-array",
    })
  );

  const assertions: [boolean, string][] = [
  [first.payout.awarded === true, "first claim is awarded"],
  [afterFirst === before + 1_000, "first claim adds the exact prize"],
  [second.payout.awarded === false, "second claim is rejected"],
  [afterSecond === afterFirst, "second claim does not change balance"],
  [second.run.rewardClaimed === true, "reopened run is marked claimed"],
  [paymentIdCount === 1, "wallet stores one quiz_reward transaction id"],
  [bestAfterFirst === 1_000, "first run records today's best"],
  [lower.payout.awarded === false && afterLower === afterSecond, "a lower run the same day banks nothing"],
  [lower.run.rewardPaid === 0 && lower.run.rewardAmount === 500, "lower run keeps its prize for stats, pays 0"],
  [afterHigher === afterLower + 3_000, "a better run banks only the difference"],
  [higher.run.rewardPaid === 3_000, "better run records what it paid"],
  [afterHigherAgain === afterHigher, "re-claiming the better run pays nothing"],
  [higherAgain.run.rewardClaimed === true, "re-claimed run is marked claimed"],
  [bestAfterHigher === 4_000, "today's best moves up"],
    [loadQuizRun() === null, "corrupt persisted quiz state is rejected"],
  ];

  let failed = 0;
  for (const [condition, message] of assertions) {
    if (condition) {
      console.log(`  ✓ ${message}`);
    } else {
      failed += 1;
      console.error(`  ✗ ${message}`);
    }
  }

  if (failed > 0) process.exit(1);
}

void main();
