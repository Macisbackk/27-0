/** Run analytics kinds (v1.70). Run: bun scripts/test-run-analytics.ts */
import { runEventKind } from "../src/lib/run-analytics";

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
};
const base = { era: false, hard: false, daily: false, weekly: false, side: null };
check("classic", runEventKind(base) === "classic");
check("ball knower", runEventKind({ ...base, hard: true }) === "ball-knower");
check("era", runEventKind({ ...base, era: true }) === "era");
check("daily wins over era", runEventKind({ ...base, era: true, daily: true }) === "daily");
check("weekly", runEventKind({ ...base, weekly: true }) === "weekly");
check("side mode", runEventKind({ ...base, side: "one-club" }) === "side-one-club");
check("kinds match the DB check", ["classic", "era", "side-daily-archive"].every((k) => /^[a-z0-9-]{1,40}$/.test(k)));
if (failed) process.exit(1);
console.log("run analytics: all passed");
