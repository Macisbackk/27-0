/**
 * Simulate Normal Mode team-year spin distribution (uniform pick audit).
 * Run: npm run debug:spin-randomness
 */
import seedrandom from "seedrandom";
import {
  getNormalModeTeamYearPools,
  pickUniformTeamYearPool,
} from "../src/lib/game/player-pool-eligibility";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";

const SPIN_COUNT = 1000;

interface SpinAuditResult {
  counts: Map<string, number>;
  eligiblePoolSize: number;
  invalidPoolCount: number;
  fallbackCount: number;
  noPlayerRerollCount: number;
}

function simulateSpins(spinCount: number): SpinAuditResult {
  const allPools = getNormalModeTeamYearPools();
  const eligible = allPools;
  const counts = new Map<string, number>();
  let fallbackCount = 0;
  let noPlayerRerollCount = 0;

  for (let i = 0; i < spinCount; i++) {
    const rng = seedrandom(`debug-spin-${i}`);
    const pick = pickUniformTeamYearPool(eligible, rng);
    if (!pick) {
      fallbackCount++;
      continue;
    }
    const id = buildTeamYearId(pick.team, pick.year);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    counts,
    eligiblePoolSize: eligible.length,
    invalidPoolCount: 0,
    fallbackCount,
    noPlayerRerollCount,
  };
}

function formatRow(rank: number, id: string, count: number, pct: number): string {
  return `${String(rank).padStart(3)}. ${id.padEnd(28)} ${String(count).padStart(5)} (${pct.toFixed(1)}%)`;
}

function main(): void {
  console.log("=== Spin Randomness Debug Report ===\n");
  console.log(`Simulating ${SPIN_COUNT} uniform team-year picks (no slot/position filters).\n`);

  const result = simulateSpins(SPIN_COUNT);
  const entries = [...result.counts.entries()].sort((a, b) => b[1] - a[1]);
  const totalPicks = entries.reduce((sum, [, c]) => sum + c, 0);
  const expected = totalPicks / Math.max(1, result.eligiblePoolSize);

  console.log(`Total eligible team-years: ${result.eligiblePoolSize}`);
  console.log(`Invalid/filtered team-years: ${result.invalidPoolCount}`);
  console.log(`Successful picks: ${totalPicks}`);
  console.log(`Fallback count: ${result.fallbackCount}`);
  console.log(`No-player-for-position reroll count: ${result.noPlayerRerollCount}`);
  console.log(`Expected ~${expected.toFixed(1)} picks per pool if uniform\n`);

  console.log("--- All team-year counts ---");
  for (const [id, count] of [...entries].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = (count / totalPicks) * 100;
    console.log(`  ${id.padEnd(28)} ${String(count).padStart(5)} (${pct.toFixed(1)}%)`);
  }

  console.log("\n--- Top 10 most selected ---");
  entries.slice(0, 10).forEach(([id, count], i) => {
    console.log(formatRow(i + 1, id, count, (count / totalPicks) * 100));
  });

  console.log("\n--- Bottom 10 least selected ---");
  const bottom = [...entries].reverse().slice(0, 10).reverse();
  bottom.forEach(([id, count], i) => {
    console.log(
      formatRow(entries.length - bottom.length + i + 1, id, count, (count / totalPicks) * 100)
    );
  });

  const leeds15 = entries.find(([id]) => id.includes("Leeds") && id.includes("2015"));
  const catalans = entries.filter(([id]) => id.toLowerCase().includes("catalans"));
  console.log("\n--- Bias watch ---");
  if (leeds15) {
    console.log(`Leeds 2015: ${leeds15[1]} (${((leeds15[1] / totalPicks) * 100).toFixed(1)}%) — expected ~${((1 / result.eligiblePoolSize) * 100).toFixed(1)}%`);
  }
  for (const [id, count] of catalans) {
    console.log(`${id}: ${count} (${((count / totalPicks) * 100).toFixed(1)}%)`);
  }

  const maxCount = entries[0]?.[1] ?? 0;
  const ratio = expected > 0 ? maxCount / expected : 0;
  if (ratio > 2.5) {
    console.error(`\nWARN: top pick is ${ratio.toFixed(1)}× expected — investigate bias`);
    process.exit(1);
  }

  console.log("\nOK: distribution within expected uniform range");
}

main();
