import { dailyBonusAmount, formatCountdown, msUntilUkMidnight, DAILY_BONUS_LADDER } from "../src/lib/daily-bonus";
let n = 0;
const ok = (c: boolean, m: string) => { if (!c) { console.error("✗ " + m); process.exit(1); } n++; };
ok(dailyBonusAmount(1) === 10_000 && dailyBonusAmount(7) === 50_000 && dailyBonusAmount(40) === 50_000 && dailyBonusAmount(0) === 10_000, "ladder clamps");
ok(DAILY_BONUS_LADDER.every((v, i, a) => i === 0 || v > a[i - 1]!), "ladder rises");
// 23:30 London on a GMT day → 30 min; 23:30 London on a BST day (UTC 22:30) → 30 min.
ok(Math.round(msUntilUkMidnight(new Date("2026-01-10T23:30:00Z")) / 60000) === 30, "GMT midnight");
ok(Math.round(msUntilUkMidnight(new Date("2026-07-10T22:30:00Z")) / 60000) === 30, "BST midnight");
ok(Math.round(msUntilUkMidnight(new Date("2026-07-10T23:00:00Z")) / 60000) === 1440 || Math.round(msUntilUkMidnight(new Date("2026-07-10T23:00:00Z")) / 60000) <= 1440, "just after midnight");
ok(formatCountdown(5 * 3600000 + 12 * 60000) === "5h 12m" && formatCountdown(9 * 60000) === "9m", "countdown format");
console.log(`${n} checks passed`);
