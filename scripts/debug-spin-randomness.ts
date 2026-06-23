/**
 * Club-uniform spin distribution audit (10,000 spins per recruit position).
 * Tests Current Mode and Era Mode pools.
 * Run: npm run debug:spin-randomness
 */
import { RECRUIT_SLOT_ORDER, createEmptySquad } from "../src/lib/positions";
import {
  getSpinTeamYearPoolsCached,
  type SpinPoolVariant,
} from "../src/lib/game/player-pool-eligibility";
import { groupPoolsByClub } from "../src/lib/game/spin-club-pick";
import { generateSlotTeamYearTargetForSlot } from "../src/lib/game/slot-team-year-pick";
import type { Position } from "../src/lib/types";

const SPINS_PER_POSITION = 10_000;

interface PositionAudit {
  variant: SpinPoolVariant;
  position: Position;
  slotIndex: number;
  totalSpins: number;
  eligibleClubs: number;
  clubCounts: Map<string, number>;
  yearCounts: Map<string, number>;
  fallbackCount: number;
  setupMsTotal: number;
}

function auditPosition(
  variant: SpinPoolVariant,
  slotIndex: number,
  spinCount: number,
  seed: string
): PositionAudit {
  const squad = createEmptySquad();
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  const position = slot?.position ?? "FULLBACK";
  const usedIds = new Set<string>();
  const usedTeamYearKeys = new Set<string>();
  const clubCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  let fallbackCount = 0;
  let setupMsTotal = 0;

  const pools = getSpinTeamYearPoolsCached(variant);
  const eligibleClubs = groupPoolsByClub(pools).size;

  for (let i = 0; i < spinCount; i++) {
    const t0 = performance.now();
    const target = generateSlotTeamYearTargetForSlot(
      `${seed}-${variant}-${slotIndex}-${i}`,
      i,
      usedIds,
      squad,
      slotIndex,
      usedTeamYearKeys,
      { spinVariant: variant }
    );
    setupMsTotal += performance.now() - t0;

    if (!target) {
      fallbackCount += 1;
      continue;
    }

    clubCounts.set(target.team, (clubCounts.get(target.team) ?? 0) + 1);
    yearCounts.set(target.year, (yearCounts.get(target.year) ?? 0) + 1);
  }

  return {
    variant,
    position,
    slotIndex,
    totalSpins: spinCount,
    eligibleClubs,
    clubCounts,
    yearCounts,
    fallbackCount,
    setupMsTotal,
  };
}

function printPositionReport(audit: PositionAudit): void {
  const entries = [...audit.clubCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalPicks = entries.reduce((s, [, c]) => s + c, 0);
  const expected = totalPicks / Math.max(1, audit.eligibleClubs);

  console.log(
    `\n=== ${audit.variant.toUpperCase()} — ${audit.position} (slot ${audit.slotIndex}) ===`
  );
  console.log(`Total spins: ${audit.totalSpins}`);
  console.log(`Eligible clubs: ${audit.eligibleClubs}`);
  console.log(`Successful picks: ${totalPicks}`);
  console.log(`Fallback count: ${audit.fallbackCount}`);
  console.log(
    `Avg spin setup: ${(audit.setupMsTotal / audit.totalSpins).toFixed(3)}ms`
  );
  console.log(`Expected ~${expected.toFixed(1)} picks per club if uniform\n`);

  console.log("Club selection counts:");
  for (const [club, count] of [...entries].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
    console.log(
      `  ${club.padEnd(28)} ${String(count).padStart(5)} (${pct.toFixed(2)}%)`
    );
  }

  if (audit.variant === "era") {
    const y2026 = audit.yearCounts.get("2026") ?? 0;
    const yearTotal = [...audit.yearCounts.values()].reduce((s, c) => s + c, 0);
    console.log(
      `\n2026 year picks: ${y2026} (${yearTotal ? ((y2026 / yearTotal) * 100).toFixed(2) : 0}% of successful spins)`
    );
  }

  const maxCount = entries[0]?.[1] ?? 0;
  const ratio = expected > 0 ? maxCount / expected : 0;
  if (ratio > 2.2) {
    console.error(`WARN: top club is ${ratio.toFixed(2)}× expected — bias suspected`);
    process.exitCode = 1;
  }
}

function main(): void {
  console.log("=== Spin Randomness Debug Report ===\n");
  console.log(`${SPINS_PER_POSITION} spins per variant × recruit slot (FULLBACK sample).\n`);

  const sampleSlot = RECRUIT_SLOT_ORDER[0]!;

  for (const variant of ["current", "era"] as const) {
    const audit = auditPosition(
      variant,
      sampleSlot,
      SPINS_PER_POSITION,
      "debug-spin-club-uniform"
    );
    printPositionReport(audit);
  }

  if (process.exitCode === 1) {
    console.error("\nFAILED: club distribution outlier detected");
    process.exit(1);
  }

  console.log("\nOK: club distributions within expected uniform range");
}

main();
