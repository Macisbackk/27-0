/**
 * Squad role migration smoke tests.
 * Run: npx tsx scripts/test-squad-roles.ts
 */

import {
  evaluateSquadRole,
  formatSquadRole,
  normalizeSquadRole,
  roleRank,
  SQUAD_ROLE_LABELS,
} from "../src/lib/manager/squadRole";
import { migrateSquadRoles } from "../src/lib/manager/migrateSquadRoles";
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

console.log("squad roles\n");

assert(normalizeSquadRole("Star") === "key-player", "Star → key-player");
assert(normalizeSquadRole("Starter") === "first-team", "Starter → first-team");
assert(normalizeSquadRole("Prospect") === "squad-depth", "Prospect → squad-depth");
assert(normalizeSquadRole("Depth") === "squad-depth", "Depth → squad-depth");
assert(
  evaluateSquadRole({ rating: 91, inStartingXiii: true, seasonAppearances: 8 }) ===
    "key-player",
  "elite starter → key-player"
);
assert(
  evaluateSquadRole({ rating: 85, inStartingXiii: true, seasonAppearances: 2 }) ===
    "first-team",
  "XI regular → first-team"
);
assert(
  evaluateSquadRole({ rating: 72, inStartingXiii: false, isReserve: true }) ===
    "reserve",
  "reserve registration → reserve"
);
assert(roleRank("key-player") > roleRank("first-team"), "key-player outranks first-team");
assert(formatSquadRole("rotation") === SQUAD_ROLE_LABELS.rotation, "format label");

const stubCareer = {
  squadRoleSchemaVersion: 0,
  matchdayXiii: ["p1"],
  squad: [{ playerId: "p1", seasonAppearances: 12, form: 60, fitness: 90, injury: null, seasonTries: 0 }],
  contracts: { p1: { wagePerYear: 100_000, yearsRemaining: 2, expiresAtSeasonEnd: false, squadRole: "Star" as never, happiness: 70 } },
  reserves: [],
  reserveContracts: {},
  fixtures: [{ round: 1 }],
} as unknown as ManagerCareer;

const migrated = migrateSquadRoles(stubCareer);
assert(migrated.squadRoleSchemaVersion === 1, "migration stamps schema version");
assert(
  migrated.contracts.p1!.squadRole !== ("Star" as never),
  "migration rewrites legacy role"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
