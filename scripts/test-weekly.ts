/**
 * Weekly Challenge tests: UK week keys and reset times, the week's seeded rule, scoring, the
 * one-ranked-attempt state, board ranking and the once-only top-10 Club Funds payout.
 * Run: bun scripts/test-weekly.ts   (or: npx tsx scripts/test-weekly.ts)
 */

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
  clear(): void {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.assign(globalThis, { window: new EventTarget(), localStorage: storage });
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

let failures = 0;
let checks = 0;
function check(condition: unknown, message: string): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}
function eq<T>(actual: T, expected: T, message: string): void {
  check(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`);
}

const DAY = 86_400_000;

async function main(): Promise<void> {
  const wc = await import("../src/lib/weekly-challenge");
  const daily = await import("../src/lib/daily-challenge");
  const { trimPaidRunIds, getClubFundsBalance, getPaidRunIds } = await import(
    "../src/lib/storage/club-funds"
  );
  const { settleWeeklyLastWeek } = await import("../src/lib/storage/weekly-leaderboard");

  // -------------------------------------------------------------------------
  // Week keys
  // -------------------------------------------------------------------------
  const keyAt = (iso: string) => wc.getWeeklyChallengeWeekKey(new Date(iso));
  // Winter (GMT): Sunday 23:59 vs Monday 00:00 UK. 25 Oct 2026 is also the clocks-back day.
  eq(keyAt("2026-10-25T12:00:00Z"), "2026-W43", "Sun 25 Oct 2026 is W43");
  eq(keyAt("2026-10-25T23:59:59Z"), "2026-W43", "Sun 23:59 GMT still W43");
  eq(keyAt("2026-10-26T00:00:00Z"), "2026-W44", "Mon 00:00 GMT is W44");
  // Summer (BST, UTC+1): the UK week turns over at 23:00 UTC on Sunday.
  eq(keyAt("2026-07-12T22:59:59Z"), "2026-W28", "Sun 23:59 BST still W28");
  eq(keyAt("2026-07-12T23:00:00Z"), "2026-W29", "Mon 00:00 BST is W29");
  // ISO year edges.
  eq(keyAt("2026-01-01T12:00:00Z"), "2026-W01", "1 Jan 2026 (Thu) is 2026-W01");
  eq(keyAt("2027-01-01T12:00:00Z"), "2026-W53", "1 Jan 2027 (Fri) is 2026-W53");
  eq(keyAt("2024-12-30T12:00:00Z"), "2025-W01", "30 Dec 2024 (Mon) is 2025-W01");
  eq(wc.getPreviousWeeklyChallengeWeekKey(new Date("2026-10-26T09:00:00Z")), "2026-W43", "previous of W44");
  eq(wc.getPreviousWeeklyChallengeWeekKey(new Date("2027-01-05T09:00:00Z")), "2026-W53", "previous of 2027-W01");

  // Every day for three years: Monday maths, round trips and contiguity.
  let lastKey = "";
  let weeksSeen = 0;
  for (let t = Date.UTC(2025, 0, 1, 12); t < Date.UTC(2028, 0, 1); t += DAY) {
    const date = new Date(t);
    const key = wc.getWeeklyChallengeWeekKey(date);
    const days = wc.getWeeklyChallengeDateKeys(date);
    eq(days.length, 7, `seven days in ${key}`);
    eq(new Date(`${days[0]}T00:00:00Z`).getUTCDay(), 1, `${key} starts on a Monday`);
    check(days.includes(daily.getDailyChallengeDateKey(date)), `${key} contains its own day`);
    eq(wc.getWeekMondayDateKey(key), days[0], `getWeekMondayDateKey(${key})`);
    if (key !== lastKey) {
      if (lastKey) {
        eq(wc.getPreviousWeeklyChallengeWeekKey(date), lastKey, `previous week of ${key}`);
        const dayBefore = new Date(Date.parse(`${days[0]}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
        eq(wc.getWeeklyChallengeDateKeys(new Date(t - DAY))[6], dayBefore, `${key} follows on from the week before`);
      }
      weeksSeen += 1;
      lastKey = key;
    }
  }
  check(weeksSeen >= 156 && weeksSeen <= 158, `about 157 weeks in 3 years (got ${weeksSeen})`);

  // Reset instant: next Monday 00:00 UK, across both DST changes.
  eq(
    new Date(wc.getWeeklyChallengeResetTime(new Date("2026-10-21T12:00:00Z"))).toISOString(),
    "2026-10-26T00:00:00.000Z",
    "reset after clocks go back is Mon 00:00 GMT"
  );
  eq(
    new Date(wc.getWeeklyChallengeResetTime(new Date("2026-03-25T12:00:00Z"))).toISOString(),
    "2026-03-29T23:00:00.000Z",
    "reset after clocks go forward is Mon 00:00 BST"
  );
  eq(
    new Date(wc.getWeeklyChallengeResetTime(new Date("2026-10-25T23:59:00Z"))).toISOString(),
    "2026-10-26T00:00:00.000Z",
    "one minute before reset"
  );
  for (let t = Date.UTC(2026, 0, 1, 7, 13); t < Date.UTC(2027, 0, 1); t += DAY / 3) {
    const now = new Date(t);
    const reset = wc.getWeeklyChallengeResetTime(now);
    check(reset > t && reset - t <= 7 * DAY + 3_600_000, `reset within a week of ${now.toISOString()}`);
    check(
      wc.getWeeklyChallengeWeekKey(new Date(reset - 1000)) === wc.getWeeklyChallengeWeekKey(now) &&
        wc.getWeeklyChallengeWeekKey(new Date(reset)) !== wc.getWeeklyChallengeWeekKey(now),
      `week changes exactly at the reset after ${now.toISOString()}`
    );
  }
  eq(wc.formatWeeklyResetCountdown(new Date("2026-10-23T22:00:00Z")), "2d 2h", "countdown days+hours");
  eq(wc.formatWeeklyResetCountdown(new Date("2026-10-25T21:00:00Z")), "3h", "countdown hours");
  eq(wc.formatWeeklyResetCountdown(new Date("2026-10-25T23:30:00Z")), "under an hour", "countdown < 1h");

  // -------------------------------------------------------------------------
  // The week's rule + seed
  // -------------------------------------------------------------------------
  const typesSeen = new Set<string>();
  const rulesSeen = new Set<string>();
  let previousSeed = "";
  for (let w = 0; w < 160; w++) {
    const monday = new Date(Date.UTC(2026, 0, 5) + w * 7 * DAY); // 5 Jan 2026 is a Monday
    const key = wc.getWeeklyChallengeWeekKey(new Date(monday.getTime() + 12 * 3_600_000));
    const days = wc.getWeeklyChallengeDateKeys(new Date(monday.getTime() + 12 * 3_600_000));
    // Instants across the week: first and last UK minute plus noon each day.
    const instants: Date[] = days.map((d) => new Date(`${d}T12:00:00Z`));
    instants.push(new Date(wc.getWeeklyChallengeResetTime(instants[0]!) - 60_000));
    // Previous week's reset is this week's Monday 00:00 UK (DST-safe).
    instants.push(new Date(wc.getWeeklyChallengeResetTime(new Date(instants[0]!.getTime() - 7 * DAY))));
    const base = wc.getWeeklyChallengeScenario(instants[0]);
    const seed = wc.getWeeklyChallengeSeed(instants[0]);
    for (const at of instants) {
      eq(wc.getWeeklyChallengeWeekKey(at), key, `instant ${at.toISOString()} is in ${key}`);
      eq(wc.getWeeklyChallengeScenario(at).id, base.id, `${key} scenario fixed all week`);
      eq(wc.getWeeklyChallengeSeed(at), seed, `${key} seed fixed all week`);
      eq(wc.getWeeklyChallengeHref(at), base.eraMode ? "/play?weekly=1&era=1" : "/play?weekly=1", `${key} href`);
    }
    eq(seed, `weekly-${key}`, `${key} seed`);
    check(seed !== previousSeed, `${key} seed differs from last week`);
    previousSeed = seed;
    for (const d of days) {
      const dailyRule = daily.getDailyChallengeScenario(new Date(`${d}T12:00:00Z`)).rule;
      check(
        JSON.stringify(dailyRule) !== JSON.stringify(base.rule),
        `${key} rule (${base.id}) differs from the Daily on ${d}`
      );
    }
    check(base.ruleTitle.length <= 18, `${key} title fits: ${base.ruleTitle}`);
    check(base.ruleSummary.length <= 60, `${key} summary fits: ${base.ruleSummary}`);
    typesSeen.add(base.ruleType);
    rulesSeen.add(JSON.stringify(base.rule));
  }
  check(typesSeen.size >= 5, `weekly rules use most rule types (got ${[...typesSeen].join(", ")})`);
  check(rulesSeen.size >= 10, `weekly rules vary (got ${rulesSeen.size} distinct)`);
  eq(wc.isWeeklyChallengeActive({ weekly: "1" }), true, "weekly=1 is active");
  eq(wc.isWeeklyChallengeActive({ weekly: null }), false, "no flag is inactive");

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------
  eq(wc.WEEKLY_MAX_SCORE, 465, "max score");
  eq(
    wc.computeWeeklyChallengeScore({ regularWins: 27, playoffWins: 3, grandFinalWon: true, leagueLeaders: true }),
    465,
    "perfect run scores the max"
  );
  eq(
    wc.computeWeeklyChallengeScore({ regularWins: 20, playoffWins: 1, grandFinalWon: false, leagueLeaders: false }),
    215,
    "20 wins + 1 play-off win"
  );
  eq(
    wc.computeWeeklyChallengeScore({ regularWins: 99, playoffWins: 9, grandFinalWon: true, leagueLeaders: true }),
    465,
    "out-of-range inputs are clamped"
  );
  eq(
    wc.computeWeeklyChallengeScore({ regularWins: 10, playoffWins: 0, grandFinalWon: true, leagueLeaders: false }),
    100,
    "no Grand Final without a play-off win"
  );
  eq(
    wc.computeWeeklyChallengeScore({ regularWins: -3, playoffWins: Number.NaN, grandFinalWon: false, leagueLeaders: false }),
    0,
    "negative / NaN inputs score 0"
  );

  // -------------------------------------------------------------------------
  // One ranked attempt per week (on-device state)
  // -------------------------------------------------------------------------
  storage.clear();
  const wkA = new Date("2026-10-21T12:00:00Z"); // W43
  const wkA2 = new Date("2026-10-24T12:00:00Z"); // W43, later
  const wkB = new Date("2026-10-27T12:00:00Z"); // W44
  eq(wc.getWeeklyChallengeAttemptUsed(wkA), false, "attempt free at start");
  eq(wc.claimWeeklyChallengeAttempt("run-a", wkA), true, "first run claims the attempt");
  eq(wc.claimWeeklyChallengeAttempt("run-a", wkA2), true, "same run still counts (remount)");
  eq(wc.claimWeeklyChallengeAttempt("run-b", wkA2), false, "second run that week is practice");
  eq(wc.getWeeklyChallengeAttemptUsed(wkA2), true, "attempt used later in the week");

  eq(
    wc.recordWeeklyChallengeEntry("run-b", { regularWins: 27, playoffWins: 3, grandFinalWon: true, leagueLeaders: true }, true, wkA2),
    null,
    "practice run can't record a score"
  );
  const regular = wc.recordWeeklyChallengeEntry(
    "run-a",
    { regularWins: 22, playoffWins: 0, grandFinalWon: false, leagueLeaders: true },
    false,
    wkA2
  );
  eq(regular?.score, 270, "regular season stored (22×10 + 50)");
  eq(regular?.final, false, "not final before the play-offs");
  const finalEntry = wc.recordWeeklyChallengeEntry(
    "run-a",
    // Tampered regular part is ignored: only the play-off result is added.
    { regularWins: 27, playoffWins: 3, grandFinalWon: true, leagueLeaders: true },
    true,
    wkA2
  );
  eq(finalEntry?.input.regularWins, 22, "regular wins frozen once recorded");
  eq(finalEntry?.score, 270 + 45 + 100, "play-off result added");
  eq(finalEntry?.final, true, "final after the play-offs");
  const again = wc.recordWeeklyChallengeEntry(
    "run-a",
    { regularWins: 27, playoffWins: 3, grandFinalWon: true, leagueLeaders: true },
    true,
    wkA2
  );
  eq(again?.score, 415, "a final entry never changes");
  eq(wc.getWeeklyChallengeEntry(wkA2)?.score, 415, "entry readable this week");
  eq(wc.getWeeklyChallengeEntry(wkB), null, "entry doesn't leak into next week");
  eq(wc.getWeeklyChallengeAttemptUsed(wkB), false, "new week, new attempt");
  eq(wc.claimWeeklyChallengeAttempt("run-c", wkB), true, "next week's first run claims");
  eq(wc.getWeeklyChallengeEntry(wkB), null, "next week starts without a score");
  wc.markWeeklyChallengeEntrySynced("2026-W43", "run-a", "final");
  // Garbage in storage never throws.
  eq(wc.parseWeeklyChallengeState("{not json").attempt, null, "bad JSON parses to defaults");
  eq(wc.parseWeeklyChallengeState(JSON.stringify({ entry: { weekKey: 3 } })).entry, null, "bad entry dropped");

  // -------------------------------------------------------------------------
  // Board ranking + top-10 reward
  // -------------------------------------------------------------------------
  const entries = Array.from({ length: 14 }, (_, i) => ({
    userId: `u${i}`,
    username: `Coach${i}`,
    score: 300 - Math.floor(i / 2) * 10, // pairs tie on score
    createdAt: `2026-10-2${i % 2 === 0 ? 1 : 0}T10:00:00Z`, // odd index entered earlier
  }));
  entries.push({ userId: "u0", username: "Coach0", score: 100, createdAt: "2026-10-19T00:00:00Z" }); // dup, lower
  entries.push({ userId: "zero", username: "Zero", score: 0, createdAt: "2026-10-19T00:00:00Z" });
  const ranked = wc.rankWeeklyEntries(entries);
  eq(ranked.length, 14, "one row per coach, zero scores dropped");
  eq(ranked[0]!.userId, "u1", "tie on score goes to the earlier entry");
  eq(ranked[1]!.userId, "u0", "later entry ranks below on a tie");
  eq(ranked[0]!.score, 300, "duplicate keeps the best score");
  eq(ranked.filter((r) => r.topTen).length, 10, "exactly ten are top 10");
  eq(ranked[9]!.topTen && !ranked[10]!.topTen, true, "top-10 cut after rank 10");
  ranked.forEach((r, i) => eq(r.rank, i + 1, `rank ${i + 1} is positional`));

  eq(wc.getWeeklyTop10Reward(1), wc.WEEKLY_TOP10_REWARD, "rank 1 paid");
  eq(wc.getWeeklyTop10Reward(10), wc.WEEKLY_TOP10_REWARD, "rank 10 paid");
  eq(wc.getWeeklyTop10Reward(11), 0, "rank 11 not paid");
  eq(wc.getWeeklyTop10Reward(null), 0, "unranked not paid");
  eq(wc.getWeeklyTop10Reward(0), 0, "rank 0 not paid");

  const afterWeek = new Date("2026-10-27T09:00:00Z"); // W44: W43 is final
  eq(wc.canClaimWeeklyTop10("2026-W43", afterWeek), true, "last week claimable");
  eq(wc.canClaimWeeklyTop10("2026-W44", afterWeek), false, "the live week isn't claimable");
  eq(wc.canClaimWeeklyTop10("2026-W42", afterWeek), false, "older weeks aren't claimable");

  const runId = wc.getWeeklyTop10RunId("2026-W43");
  eq(runId, "weekly-top10-2026-W43-2026-10-19", "ledger id carries the Monday");
  const undated = Array.from({ length: 400 }, (_, i) => `run-${i}`);
  check(trimPaidRunIds([runId, ...undated], afterWeek).includes(runId), "ledger trim keeps the id among 400 runs");
  check(
    trimPaidRunIds([runId, ...undated], new Date(afterWeek.getTime() + 30 * DAY)).includes(runId),
    "ledger trim keeps the id 30 days on"
  );

  // Payout: once, however often it's settled, even with the device cache wiped.
  storage.clear();
  const before = getClubFundsBalance();
  const first = settleWeeklyLastWeek("2026-W43", 4, afterWeek);
  eq(first?.awardedNow, wc.WEEKLY_TOP10_REWARD, "top-10 finish pays");
  eq(getClubFundsBalance(), before + wc.WEEKLY_TOP10_REWARD, "balance up by the reward");
  const second = settleWeeklyLastWeek("2026-W43", 4, afterWeek);
  eq(second?.awardedNow, 0, "second settle pays nothing");
  storage.setItem("27-0-weekly", "{}"); // wipe the weekly cache, keep the ledger
  const third = settleWeeklyLastWeek("2026-W43", 4, new Date(afterWeek.getTime() + 2 * DAY));
  eq(third?.awardedNow, 0, "ledger blocks a repeat after the cache is wiped");
  eq(getClubFundsBalance(), before + wc.WEEKLY_TOP10_REWARD, "balance paid exactly once");
  check(getPaidRunIds().includes(runId), "ledger records the payout id");
  eq(settleWeeklyLastWeek("2026-W44", 1, afterWeek), null, "live week can't be settled");
  eq(settleWeeklyLastWeek("2026-W42", 1, afterWeek), null, "older week can't be settled");
  eq(settleWeeklyLastWeek("2026-W43", 11, afterWeek), null, "rank 11 gets nothing");
  eq(getClubFundsBalance(), before + wc.WEEKLY_TOP10_REWARD, "balance unchanged by refused settles");

  // Last week's scenario by week key, including the hour after the spring clock change.
  for (const iso of ["2026-03-29T23:30:00Z", "2026-10-26T00:30:00Z", "2027-01-04T00:10:00Z"]) {
    const now = new Date(iso);
    const prevKey = wc.getPreviousWeeklyChallengeWeekKey(now);
    const prevMonday = wc.getWeekMondayDateKey(prevKey);
    const [py, pm, pd] = prevMonday.split("-").map(Number);
    const expected = wc.getWeeklyChallengeScenario(new Date(Date.UTC(py!, pm! - 1, pd! + 3, 12)));
    eq(JSON.stringify(wc.getWeeklyChallengeScenarioForWeek(prevKey).rule), JSON.stringify(expected.rule), `last week's rule at ${iso}`);
  }

  // Another account signing in on this device must not inherit the Weekly attempt / cache.
  const owner = await import("../src/lib/storage/account-owner");
  const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
  check(owner.ACCOUNT_STORAGE_KEYS.includes(STORAGE_KEYS.weeklyChallenge), "weekly state is per account");
  check(owner.ACCOUNT_STORAGE_KEYS.includes("27-0-daily-bonus"), "daily bonus cache is per account");
  owner.claimDeviceForAccount("user-a");
  wc.claimWeeklyChallengeAttempt("run-weekly-a", new Date());
  check(wc.getWeeklyChallengeAttemptUsed(new Date()), "account A has used its attempt");
  owner.claimDeviceForAccount("user-b");
  check(!wc.getWeeklyChallengeAttemptUsed(new Date()), "account B starts with its own attempt");
  check(wc.loadWeeklyChallengeState().lastWeek === null, "account B doesn't see A's last-week cache");

  if (failures > 0) {
    console.error(`\n${failures} of ${checks} checks failed.`);
    process.exit(1);
  }
  console.log(`Weekly Challenge: all ${checks} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
