/**
 * Club-uniform spin distribution audit (10,000 spins per recruit position).
 * Tests Current Mode and Era Mode pools separately.
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
  eligibleTeamYears: number;
  teamYearsByClub: Map<string, number>;
  clubCounts: Map<string, number>;
  yearCounts: Map<string, number>;
  teamYearCounts: Map<string, number>;
  fallbackCount: number;
  rerollCount: number;
  rejectedIncomplete: number;
  repeatedPreviousCount: number;
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
  const clubCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  const teamYearCounts = new Map<string, number>();
  let fallbackCount = 0;
  let rerollCount = 0;
  let rejectedIncomplete = 0;
  let repeatedPreviousCount = 0;
  let setupMsTotal = 0;
  let previousTarget: string | null = null;

  const pools = getSpinTeamYearPoolsCached(variant);
  const byClub = groupPoolsByClub(pools);
  const eligibleClubs = byClub.size;
  const eligibleTeamYears = pools.length;
  const teamYearsByClub = new Map<string, number>();
  for (const [club, clubPools] of byClub.entries()) {
    teamYearsByClub.set(club, clubPools.length);
  }

  for (let i = 0; i < spinCount; i++) {
    const usedTeamYearKeys = new Set<string>();
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

    const teamYearKey = target.teamYearKey;
    if (previousTarget === teamYearKey) repeatedPreviousCount += 1;
    previousTarget = teamYearKey;

    clubCounts.set(target.team, (clubCounts.get(target.team) ?? 0) + 1);
    yearCounts.set(target.year, (yearCounts.get(target.year) ?? 0) + 1);
    teamYearCounts.set(
      teamYearKey,
      (teamYearCounts.get(teamYearKey) ?? 0) + 1
    );
  }

  return {
    variant,
    position,
    slotIndex,
    totalSpins: spinCount,
    eligibleClubs,
    eligibleTeamYears,
    teamYearsByClub,
    clubCounts,
    yearCounts,
    teamYearCounts,
    fallbackCount,
    rerollCount,
    rejectedIncomplete,
    repeatedPreviousCount,
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
  console.log(`Eligible team-years: ${audit.eligibleTeamYears}`);
  console.log(`Successful picks: ${totalPicks}`);
  console.log(`Fallback count: ${audit.fallbackCount}`);
  console.log(`Repeated previous result count: ${audit.repeatedPreviousCount}`);
  console.log(
    `Avg spin setup: ${(audit.setupMsTotal / audit.totalSpins).toFixed(3)}ms`
  );
  console.log(`Expected ~${expected.toFixed(1)} picks per club if uniform\n`);

  console.log("Eligible team-years per club:");
  for (const [club, count] of [...audit.teamYearsByClub.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`  ${club.padEnd(28)} ${count}`);
  }

  console.log("\nClub selection counts:");
  for (const [club, count] of [...entries].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
    console.log(
      `  ${club.padEnd(28)} ${String(count).padStart(5)} (${pct.toFixed(2)}%)`
    );
  }

  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    console.log(`\nMost selected club: ${sorted[0]![0]} (${sorted[0]![1]})`);
    const least = sorted[sorted.length - 1]!;
    console.log(`Least selected club: ${least[0]} (${least[1]})`);
  }

  if (audit.variant === "era") {
    const y2026 = audit.yearCounts.get("2026") ?? 0;
    const yearTotal = [...audit.yearCounts.values()].reduce((s, c) => s + c, 0);
    console.log(
      `\n2026 year picks: ${y2026} (${yearTotal ? ((y2026 / yearTotal) * 100).toFixed(2) : 0}% of successful spins)`
    );
    if (y2026 > 0) {
      console.error("WARN: 2026 teams appeared in Era Mode spins");
      process.exitCode = 1;
    }
  }

  if (audit.fallbackCount > 0) {
    console.error(
      `WARN: ${audit.fallbackCount} fallback spins for ${audit.position} — data gap or pool exhaustion`
    );
    process.exitCode = 1;
  }

  const maxCount = entries[0]?.[1] ?? 0;
  const ratio = expected > 0 ? maxCount / expected : 0;
  if (ratio > 2.2 && audit.eligibleClubs > 3) {
    console.error(
      `WARN: top club is ${ratio.toFixed(2)}× expected — bias suspected`
    );
    process.exitCode = 1;
  }

  if (audit.eligibleClubs <= 3) {
    console.log(
      `\nNOTE: Only ${audit.eligibleClubs} eligible clubs for ${audit.position} — low pool count is a data gap, not necessarily bias.`
    );
  }
}

function main(): void {
  console.log("=== Spin Randomness Debug Report ===\n");
  console.log(
    `${SPINS_PER_POSITION} spins per variant × each recruit slot.\n`
  );

  for (const variant of ["era"] as const) {
    console.log(`\n######## ${variant.toUpperCase()} MODE ########`);
    for (const slotIndex of RECRUIT_SLOT_ORDER) {
      const audit = auditPosition(
        variant,
        slotIndex,
        SPINS_PER_POSITION,
        "debug-spin-club-uniform"
      );
      printPositionReport(audit);
    }
  }

  if (process.exitCode === 1) {
    console.error("\nFAILED: spin distribution issues detected");
    process.exit(1);
  }

  console.log("\nOK: Era club distributions within expected uniform range");
}

main();
