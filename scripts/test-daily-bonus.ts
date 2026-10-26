import { dailyBonusAmount, dailyBonusRunId, formatCountdown, msUntilUkMidnight, nextDailyBonusDay, DAILY_BONUS_LADDER } from "../src/lib/daily-bonus";
import { getLocalDateKey } from "../src/lib/mini-games/date";
let n = 0;
const ok = (c: boolean, m: string) => { if (!c) { console.error("✗ " + m); process.exit(1); } n++; };
ok(dailyBonusAmount(1) === 10_000 && dailyBonusAmount(7) === 50_000 && dailyBonusAmount(40) === 50_000 && dailyBonusAmount(0) === 10_000, "ladder clamps");
ok(DAILY_BONUS_LADDER.every((v, i, a) => i === 0 || v > a[i - 1]!), "ladder rises");
// 23:30 London on a GMT day → 30 min; 23:30 London on a BST day (UTC 22:30) → 30 min.
ok(Math.round(msUntilUkMidnight(new Date("2026-01-10T23:30:00Z")) / 60000) === 30, "GMT midnight");
ok(Math.round(msUntilUkMidnight(new Date("2026-07-10T22:30:00Z")) / 60000) === 30, "BST midnight");
ok(Math.round(msUntilUkMidnight(new Date("2026-07-10T23:00:00Z")) / 60000) === 1440 || Math.round(msUntilUkMidnight(new Date("2026-07-10T23:00:00Z")) / 60000) <= 1440, "just after midnight");
ok(formatCountdown(5 * 3600000 + 12 * 60000) === "5h 12m" && formatCountdown(9 * 60000) === "9m", "countdown format");
// Streak comes from the synced paid ledger, so a second device / cleared bonus key keeps it.
const paid = ["2026-11-01", "2026-11-02", "2026-11-03"].map(dailyBonusRunId);
ok(nextDailyBonusDay("2026-11-04", paid) === 4, "ledger streak on a device with no local state");
ok(nextDailyBonusDay("2026-11-04", paid, { day: 1, lastClaimedDateKey: "2026-10-20" }) === 4, "stale local state ignored");
ok(nextDailyBonusDay("2026-11-05", paid, { day: 3, lastClaimedDateKey: "2026-11-03" }) === 1, "missed day resets");
ok(nextDailyBonusDay("2026-11-04", [], { day: 6, lastClaimedDateKey: "2026-11-03" }) === 1, "local state alone (other account's) does not carry a streak");
ok(nextDailyBonusDay("2026-11-04", paid, { day: 60, lastClaimedDateKey: "2026-11-03" }) === 61, "long streak past ledger memory kept");
ok(nextDailyBonusDay("2026-01-01", ["2025-12-31", "2025-12-30"].map(dailyBonusRunId)) === 3, "streak across new year");
// Clock change (BST→GMT 2026-10-25): the 25-hour day is one bonus day; its midnight is 25h after the previous.
ok(nextDailyBonusDay("2026-10-26", ["2026-10-24", "2026-10-25"].map(dailyBonusRunId)) === 3, "streak across clock change");
ok(getLocalDateKey(new Date("2026-10-25T23:30:00Z")) === "2026-10-25" && getLocalDateKey(new Date("2026-10-24T23:30:00Z")) === "2026-10-25", "25-hour UK day");
ok(Math.round(msUntilUkMidnight(new Date("2026-10-24T23:00:00Z")) / 60_000) === 25 * 60, "25h until midnight from 00:00 BST on change day");
ok(Math.round(msUntilUkMidnight(new Date("2026-03-29T00:00:00Z")) / 60_000) === 23 * 60, "23h until midnight from 00:00 GMT on spring change day");
for (let x = Date.parse("2026-10-23T00:00:00Z"); x < Date.parse("2026-10-28T00:00:00Z"); x += 17 * 60_000 + 7_000) {
  const ms = msUntilUkMidnight(new Date(x));
  ok(getLocalDateKey(new Date(x + ms)) !== getLocalDateKey(new Date(x)) && getLocalDateKey(new Date(x + ms - 2000)) === getLocalDateKey(new Date(x)), "midnight found " + new Date(x).toISOString());
}
console.log(`${n} checks passed`);
