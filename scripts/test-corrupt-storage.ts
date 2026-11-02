/**
 * Damaged local storage must never crash a page: every reader that runs on page load is fed
 * garbage, wrong-shaped JSON, arrays, null and huge numbers and must return something usable.
 * Run: bun scripts/test-corrupt-storage.ts
 */
const store = new Map<string, string>();
const memory = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = memory;
g.sessionStorage = memory;
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.dispatchEvent = () => true;
g.CustomEvent ??= class {
  constructor(public type: string) {}
};

const { runCoachbeardAccountMergeLocal } = await import("../src/lib/storage/coachbeard-account-merge");
const { getLocalQuizLeaderboard } = await import("../src/lib/storage/quiz-leaderboard");
const { getLocalMiniGameWins, updateLocalMiniGameWins } = await import("../src/lib/storage/mini-games-leaderboard");
const { getClubFundsLeaderboardAsync } = await import("../src/lib/storage/club-funds-leaderboard");
const { getDailyLeaderboardAsync } = await import("../src/lib/storage/daily-leaderboard");
const { syncTrophyCabinetLeaderboardOnLoad } = await import("../src/lib/storage/trophy-cabinet-leaderboard");
const { parseEntryMap } = await import("../src/lib/storage/safe-json");

const KEYS = [
  "27-0-leaderboard",
  "27-0-club-funds-leaderboard",
  "27-0-club-funds",
  "27-0-stats",
  "27-0-stats-coachbeard2-snapshot",
  "27-0-quiz-leaderboard",
  "27-0-mini-games-leaderboard",
  "27-0-daily-leaderboard",
  "27-0-trophy-cabinet-leaderboard",
];
const BAD = [
  '{"broken":',
  "null",
  "1e309",
  '"text"',
  "[null,1,\"x\",{}]",
  JSON.stringify({ wins: "lots", games: null, balance: -1, version: 999, items: "x", owned: "all" }),
  JSON.stringify({ coachbeard2: { username: "coachbeard2", totalEarned: "x" }, alice: null, bob: [1] }),
  JSON.stringify([{ username: 5 }, { username: "coachbeard2", mode: "NORMAL" }, null]),
  JSON.stringify({ wordle: { a: null, b: { username: "b", wins: 2, updatedAt: "2026-01-01" } }, grid: [], "quiz-wins": 7 }),
];

let failures = 0;
const check = async (label: string, fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    failures++;
    console.error(`✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
};

for (const value of BAD) {
  for (const coachName of [null, "coachbeard"]) {
    store.clear();
    for (const k of KEYS) store.set(k, value);
    const tag = `${value.slice(0, 30)} (coach ${coachName ?? "none"})`;
    await check(`coach merge with ${tag}`, () => runCoachbeardAccountMergeLocal({ coachName, email: null }));
    await check(`quiz board with ${tag}`, () => getLocalQuizLeaderboard());
    await check(`mini-game board with ${tag}`, () => {
      updateLocalMiniGameWins("wordle", { username: "tester", wins: 3 });
      getLocalMiniGameWins("wordle");
      getLocalMiniGameWins("grid");
    });
    await check(`club funds board with ${tag}`, () => getClubFundsLeaderboardAsync());
    await check(`daily board with ${tag}`, () => getDailyLeaderboardAsync());
    await check(`trophy cabinet with ${tag}`, () => syncTrophyCabinetLeaderboardOnLoad());
  }
}

// Good entries survive, bad ones are dropped.
const kept = parseEntryMap<{ username: string }>(
  JSON.stringify({ a: { username: "a", wins: 1 }, b: { username: 2, wins: 1 }, c: null, d: { username: "d", wins: Infinity } }),
  { username: "string", wins: "number" }
);
if (Object.keys(kept).join(",") !== "a") {
  failures++;
  console.error(`✗ parseEntryMap kept ${Object.keys(kept).join(",")} (expected a)`);
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`✓ corrupted storage: ${BAD.length} bad values × 2 coaches × 6 readers, no crash`);
process.exit(0);
