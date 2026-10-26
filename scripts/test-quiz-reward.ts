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

  // Golden Point Quiz: the day's first run pays in full, later runs pay 10%, daily cap £100k.
  const { getQuizDayLedger, QUIZ_DAILY_CAP } = await import("../src/lib/quiz/rewards");
  const { QUIZ_TOP_PRIZE, QUIZ_PRIZE_LADDER } = await import("../src/lib/quiz/prizes");
  const ledgerAfterFirst = getQuizDayLedger();
  const lower = claimQuizReward({ ...run, id: "reward-lower-run", rewardAmount: 500 });
  const afterLower = getClubFundsBalance();
  const higher = claimQuizReward({ ...run, id: "reward-higher-run", rewardAmount: 4_000 });
  const afterHigher = getClubFundsBalance();
  const higherAgain = claimQuizReward({ ...run, id: "reward-higher-run", rewardAmount: 4_000 });
  const afterHigherAgain = getClubFundsBalance();
  const ledgerAfterHigher = getQuizDayLedger();
  // Grind perfect runs all day: the quiz must never pay more than the daily cap.
  for (let i = 0; i < 30; i += 1) {
    claimQuizReward({ ...run, id: `reward-grind-${i}`, rewardAmount: QUIZ_TOP_PRIZE });
  }
  const ledgerAfterGrind = getQuizDayLedger();
  const afterGrind = getClubFundsBalance();
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
  [ledgerAfterFirst.runs === 1 && ledgerAfterFirst.paid === 1_000, "first run records today's ledger"],
  [lower.payout.awarded === true && afterLower === afterSecond + 50, "a repeat run pays 10% of its prize"],
  [lower.run.rewardPaid === 50 && lower.run.rewardAmount === 500, "repeat run keeps its prize for stats, records what it paid"],
  [afterHigher === afterLower + 400, "a better repeat run also pays 10%"],
  [higher.run.rewardPaid === 400, "better run records what it paid"],
  [afterHigherAgain === afterHigher, "re-claiming a run pays nothing"],
  [higherAgain.run.rewardClaimed === true, "re-claimed run is marked claimed"],
  [ledgerAfterHigher.runs === 3 && ledgerAfterHigher.paid === 1_450, "ledger counts runs and payouts"],
  [ledgerAfterGrind.paid === QUIZ_DAILY_CAP, "repeat perfect runs stop at the daily cap"],
  [afterGrind - before === QUIZ_DAILY_CAP, "the quiz pays at most the cap in one day"],
  [QUIZ_TOP_PRIZE <= 150_000, "top prize is at most £150k (Classic stays the best earner)"],
  [QUIZ_PRIZE_LADDER.every((v, i, all) => i === 0 || v > all[i - 1]!), "prize ladder strictly increases"],
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
