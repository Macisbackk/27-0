/**
 * Fuzz week advances and assert no dual-registration invariants.
 * Run: npx tsx scripts/test-transfer-invariants.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { processTransferMarketForWeek } from "../src/lib/manager/processTransferMarketForWeek";
import { assertCareerTransferInvariants } from "../src/lib/manager/transferInvariants";
import type { ManagerCareer } from "../src/lib/manager/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

console.log("Transfer invariants fuzz\n");

let career: ManagerCareer = createNewCareer("Catalans Dragons");

for (let week = 1; week <= 12; week++) {
  career = { ...career, gameWeek: week };
  career = processTransferMarketForWeek(career);
  // Second call same week must be no-op for scan gate
  const again = processTransferMarketForWeek(career);
  assert(
    again.lastTransferScanGameWeek === week,
    `week ${week} scan gated`
  );
  career = again;

  const inv = assertCareerTransferInvariants(career);
  if (!inv.valid) {
    console.error(inv.violations.slice(0, 8).join("\n"));
  }
  assert(inv.valid, `career invariants hold after week ${week}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
