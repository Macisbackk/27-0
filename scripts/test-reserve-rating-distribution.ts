/**
 * Reserve rating distribution regression test.
 *
 * Verifies the v5 generator retune (RESERVE_RATING_BANDS, mean ~69-71,
 * majority below 77, 80+ extremely rare):
 * - Fresh generation (generateReserveSquad) targets a ~69-71 average.
 * - createNewCareer stamps the current rating schema so hydrate's
 *   migration passes don't re-floor freshly generated reserves onto the
 *   legacy Current-senior 80 floor.
 * - Even a "legacy" career with unset schema versions (simulating an old
 *   save) no longer gets its reserves floored at 80 by migratePlayerRatingsV3.
 *
 * Run: npx tsx scripts/test-reserve-rating-distribution.ts
 */
import { generateReserveSquad } from "../src/lib/manager/managerReserves";
import { createNewCareer } from "../src/lib/manager/managerState";
import { migratePlayerRatingsV5 } from "../src/lib/manager/migratePlayerRatingsV5";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import type { ManagerCareer } from "../src/lib/manager/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.error(`  \u2717 ${message}`);
  }
}

interface Stats {
  count: number;
  sum: number;
  values: number[];
  nanCount: number;
  below70: number;
  exactly80: number;
  atOrAbove80: number;
  buckets: Record<string, number>;
}

const BUCKET_ORDER = ["<70", "70-72", "73-75", "76-78", "79-81", "82-84", "85+"];

function bucketFor(rating: number): string {
  if (rating < 70) return "<70";
  if (rating <= 72) return "70-72";
  if (rating <= 75) return "73-75";
  if (rating <= 78) return "76-78";
  if (rating <= 81) return "79-81";
  if (rating <= 84) return "82-84";
  return "85+";
}

function collectStats(ratings: number[]): Stats {
  const stats: Stats = {
    count: 0,
    sum: 0,
    values: [],
    nanCount: 0,
    below70: 0,
    exactly80: 0,
    atOrAbove80: 0,
    buckets: {},
  };
  for (const rating of ratings) {
    stats.count++;
    if (!Number.isFinite(rating)) {
      stats.nanCount++;
      continue;
    }
    stats.sum += rating;
    stats.values.push(rating);
    if (rating < 70) stats.below70++;
    if (Math.round(rating) === 80) stats.exactly80++;
    if (rating >= 80) stats.atOrAbove80++;
    stats.buckets[bucketFor(rating)] = (stats.buckets[bucketFor(rating)] ?? 0) + 1;
  }
  return stats;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function pct(part: number, total: number): string {
  return total === 0 ? "0.0" : ((part / total) * 100).toFixed(1);
}

function printStats(label: string, stats: Stats): void {
  const avg = stats.values.length ? stats.sum / stats.values.length : NaN;
  console.log(`\n${label}`);
  console.log(`  n=${stats.count}  nan=${stats.nanCount}`);
  console.log(`  average=${avg.toFixed(2)}  median=${median(stats.values).toFixed(1)}`);
  console.log(`  below70=${stats.below70} (${pct(stats.below70, stats.count)}%)`);
  console.log(`  exactly80=${stats.exactly80} (${pct(stats.exactly80, stats.count)}%)`);
  console.log(`  atOrAbove80=${stats.atOrAbove80} (${pct(stats.atOrAbove80, stats.count)}%)`);
  for (const bucket of BUCKET_ORDER) {
    const c = stats.buckets[bucket] ?? 0;
    console.log(`  ${bucket.padEnd(6)}: ${String(c).padStart(6)} (${pct(c, stats.count)}%)`);
  }
}

function assertHealthyDistribution(label: string, stats: Stats): void {
  const avg = stats.values.length ? stats.sum / stats.values.length : NaN;
  assert(
    avg >= 68.5 && avg <= 71.5,
    `${label}: average ${avg.toFixed(2)} within 69-71 (\u00b10.5)`
  );
  const belowFloor = stats.values.filter((r) => r < 65).length;
  assert(belowFloor === 0, `${label}: zero reserves below the 65 floor (found ${belowFloor})`);
  assert(
    stats.atOrAbove80 / Math.max(1, stats.count) < 0.03,
    `${label}: fewer than 3% at 80+ (${pct(stats.atOrAbove80, stats.count)}%)`
  );
  const above76 = stats.values.filter((r) => r > 76).length;
  assert(
    above76 / Math.max(1, stats.count) < 0.25,
    `${label}: fewer than 25% above 76 (${pct(above76, stats.count)}%) — majority stay below 77`
  );
  assert(stats.nanCount === 0, `${label}: no NaN ratings (found ${stats.nanCount})`);
}

console.log("Reserve rating distribution\n" + "=".repeat(40));

// --- 1. Bulk fresh generation: 1000 seeds x 24 reserves = 24,000 samples ---
console.log("\n[1] Fresh generation via generateReserveSquad (1000 seeds x 24 reserves)");
const bulkRatings: number[] = [];
for (let i = 0; i < 1000; i++) {
  const seed = `dist-test-seed-${i}`;
  const club = CURRENT_PLAYABLE_CLUBS[i % CURRENT_PLAYABLE_CLUBS.length]!;
  const squad = generateReserveSquad(seed, 24, club, 2020 + (i % 6));
  for (const reserve of squad) bulkRatings.push(reserve.rating);
}
const bulkStats = collectStats(bulkRatings);
printStats("Fresh generation (generateReserveSquad)", bulkStats);
assertHealthyDistribution("Fresh generation", bulkStats);

// --- 2. Full hydrate/migrate path via createNewCareer (schema-stamped) ---
console.log("\n[2] createNewCareer full hydrate/migrate path (schema-stamped)");
const CAREER_SAMPLE = 60;
const careerRatings: number[] = [];
const careers: ManagerCareer[] = [];
for (let i = 0; i < CAREER_SAMPLE; i++) {
  const club = CURRENT_PLAYABLE_CLUBS[i % CURRENT_PLAYABLE_CLUBS.length]!;
  const career = createNewCareer(club);
  careers.push(career);
  for (const reserve of career.reserves) careerRatings.push(reserve.rating);
}
const careerStats = collectStats(careerRatings);
printStats("createNewCareer reserves", careerStats);
assertHealthyDistribution("createNewCareer reserves", careerStats);
assert(
  careers.every((c) => (c.playerRatingSchemaVersion ?? 0) >= 5),
  "createNewCareer stamps playerRatingSchemaVersion >= 5"
);
assert(
  careers.every((c) => (c.reserveRatingScaleVersion ?? 0) >= 3),
  "createNewCareer stamps reserveRatingScaleVersion >= 3"
);

// --- 3. Legacy save simulation: strip schema stamps and re-run migratePlayerRatingsV5 ---
// This proves migratePlayerRatingsV3 (run internally via V4 -> V5) no longer
// floors freshly generated, correctly-scaled reserves onto the Current 80 floor.
console.log(
  "\n[3] Legacy save simulation (unset schema versions) through migratePlayerRatingsV5"
);
const legacyRatings: number[] = [];
for (const base of careers) {
  const legacyCareer: ManagerCareer = {
    ...base,
    playerRatingSchemaVersion: undefined,
    reserveRatingScaleVersion: undefined,
    championshipRatingScaleVersion: undefined,
    currentNinetyPlusAuditVersion: undefined,
  };
  const migrated = migratePlayerRatingsV5(legacyCareer);
  for (const reserve of migrated.reserves) legacyRatings.push(reserve.rating);
}
const legacyStats = collectStats(legacyRatings);
printStats("Legacy (unset schema) -> migratePlayerRatingsV5 reserves", legacyStats);
assertHealthyDistribution("Legacy migration path", legacyStats);

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  console.error("\nFAILED");
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
