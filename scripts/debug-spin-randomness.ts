/**
 * Club-uniform spin distribution audit (10,000 spins per recruit position).
 * Run: npm run debug:spin-randomness
 */
import seedrandom from "seedrandom";
import { RECRUIT_SLOT_ORDER, createEmptySquad } from "../src/lib/positions";
import { getNormalModeTeamYearPoolsCached } from "../src/lib/game/player-pool-eligibility";
import { groupPoolsByClub } from "../src/lib/game/spin-club-pick";
import { generateSlotTeamYearTargetForSlot } from "../src/lib/game/slot-team-year-pick";
import type { Position } from "../src/lib/types";

const SPINS_PER_POSITION = 10_000;

interface PositionAudit {
  position: Position;
  slotIndex: number;
  totalSpins: number;
  eligibleClubs: number;
  clubCounts: Map<string, number>;
  fallbackCount: number;
  setupMsTotal: number;
}

function auditPosition(
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
  let fallbackCount = 0;
  let setupMsTotal = 0;

  const pools = getNormalModeTeamYearPoolsCached();
  const eligibleClubs = groupPoolsByClub(pools).size;

  for (let i = 0; i < spinCount; i++) {
    const t0 = performance.now();
    const target = generateSlotTeamYearTargetForSlot(
      `${seed}-${slotIndex}-${i}`,
      i,
      usedIds,
      squad,
      slotIndex,
      usedTeamYearKeys
    );
    setupMsTotal += performance.now() - t0;

    if (!target) {
      fallbackCount += 1;
      continue;
    }

    clubCounts.set(target.team, (clubCounts.get(target.team) ?? 0) + 1);
  }

  return {
    position,
    slotIndex,
    totalSpins: spinCount,
    eligibleClubs,
    clubCounts,
    fallbackCount,
    setupMsTotal,
  };
}

function printPositionReport(audit: PositionAudit): void {
  const entries = [...audit.clubCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalPicks = entries.reduce((s, [, c]) => s + c, 0);
  const expected = totalPicks / Math.max(1, audit.eligibleClubs);

  console.log(`\n=== Position: ${audit.position} (slot ${audit.slotIndex}) ===`);
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

  console.log("\nTop 5 most selected:");
  entries.slice(0, 5).forEach(([club, count], i) => {
    const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
    console.log(`  ${i + 1}. ${club}: ${count} (${pct.toFixed(2)}%)`);
  });

  console.log("\nBottom 5 least selected:");
  const bottom = [...entries].reverse().slice(0, 5).reverse();
  bottom.forEach(([club, count]) => {
    const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
    console.log(`  ${club}: ${count} (${pct.toFixed(2)}%)`);
  });

  const catalans = entries
    .filter(([c]) => c.toLowerCase().includes("catalans"))
    .reduce((s, [, c]) => s + c, 0);
  const castleford = entries
    .filter(([c]) => c.toLowerCase().includes("castleford"))
    .reduce((s, [, c]) => s + c, 0);
  console.log(
    `\nCatalans total: ${catalans} (${totalPicks ? ((catalans / totalPicks) * 100).toFixed(2) : 0}%)`
  );
  console.log(
    `Castleford total: ${castleford} (${totalPicks ? ((castleford / totalPicks) * 100).toFixed(2) : 0}%)`
  );

  const maxCount = entries[0]?.[1] ?? 0;
  const ratio = expected > 0 ? maxCount / expected : 0;
  if (ratio > 2.2) {
    console.error(`WARN: top club is ${ratio.toFixed(2)}× expected — bias suspected`);
    process.exitCode = 1;
  }
}

function main(): void {
  console.log("=== Spin Randomness Debug Report (club-uniform) ===\n");
  console.log(`${SPINS_PER_POSITION} spins per recruit slot position.\n`);

  const uniqueSlots = [...new Set(RECRUIT_SLOT_ORDER)];

  for (const slotIndex of uniqueSlots) {
    const audit = auditPosition(
      slotIndex,
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
