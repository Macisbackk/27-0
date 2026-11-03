/**
 * Device stats cloud backup (v1.66): the merge keeps the side with more history, per key.
 * Run: bun scripts/test-device-stats-merge.ts
 */
import { activityScore, mergeDeviceStats } from "../src/lib/storage/device-stats-merge";
import { STORAGE_KEYS } from "../src/lib/storage/keys";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}

const W = STORAGE_KEYS.wordleStats;
const Q = STORAGE_KEYS.quizStats;
const M = STORAGE_KEYS.modeRecords;

check("activity counts played", activityScore({ played: 12, wins: 9 }) === 12);
check("activity counts nested", activityScore({ oneClub: { a: { seasons: 3 }, b: { seasons: 2 } }, gauntlet: { runs: 4 } }) === 9);
check("activity of junk is 0", activityScore(null) === 0 && activityScore("x") === 0);

// New device (empty) signing in: everything comes from the cloud, nothing pushed over it.
{
  const r = mergeDeviceStats({}, { [W]: { played: 40 }, [Q]: { played: 5 } });
  check("fresh device takes cloud", r.takeFromCloud.length === 2 && !r.pushNeeded);
}
// Guest with history, first sign-in (no cloud row): push it up.
{
  const r = mergeDeviceStats({ [W]: { played: 3 } }, null);
  check("guest history pushed", r.pushNeeded && r.takeFromCloud.length === 0);
}
// Busier local beats older cloud; busier cloud beats local; per key.
{
  const r = mergeDeviceStats({ [W]: { played: 50 }, [Q]: { played: 1 } }, { [W]: { played: 10 }, [Q]: { played: 30 } });
  check("per-key winner", r.merged[W] && (r.merged[W] as { played: number }).played === 50 && (r.merged[Q] as { played: number }).played === 30);
  check("cloud key taken", r.takeFromCloud.length === 1 && r.takeFromCloud[0] === Q);
  check("local winner pushed", r.pushNeeded);
}
// Identical sides: no writes either way.
{
  const same = { [M]: { gauntlet: { runs: 2 } } };
  const r = mergeDeviceStats(same, JSON.parse(JSON.stringify(same)));
  check("identical = no-op", !r.pushNeeded && r.takeFromCloud.length === 0);
}
// Keys outside the list are never imported from the cloud.
{
  const r = mergeDeviceStats({}, { "27-0-something-else": { played: 99 } });
  check("unknown keys ignored", r.takeFromCloud.length === 0 && !("27-0-something-else" in r.merged));
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("device stats merge: all passed");
