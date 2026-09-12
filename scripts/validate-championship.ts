/**
 * Validate Championship expansion data: clubs, squads, cup structure, and Manager Mode integration.
 * Run: npx tsx scripts/validate-championship.ts
 */
import { CHAMPIONSHIP_CLUBS } from "../src/lib/clubs/championship-clubs";
import { initializeManagerDatabase } from "../src/lib/manager/database";
import { sortStandings } from "../src/lib/manager/competitions";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

console.log("=== Validating Championship Clubs Data ===");
assert(CHAMPIONSHIP_CLUBS.length >= 12, "At least 12 Championship clubs in database");
const ids = new Set(CHAMPIONSHIP_CLUBS.map((c) => c.id));
assert(ids.size === CHAMPIONSHIP_CLUBS.length, "Unique Championship club IDs");
assert(
  CHAMPIONSHIP_CLUBS.every((c) => c.abbreviation && c.abbreviation.length >= 2),
  "Every club has valid abbreviation"
);
assert(
  CHAMPIONSHIP_CLUBS.every(
    (c) =>
      /^#[0-9A-Fa-f]{6}$/.test(c.primaryColor) &&
      /^#[0-9A-Fa-f]{6}$/.test(c.secondaryColor)
  ),
  "Valid hex colours"
);
assert(
  CHAMPIONSHIP_CLUBS.every((c) => c.challengeCupEligible),
  "All Challenge Cup eligible"
);

console.log("\n=== Validating Manager Mode Championship World ===");
const state = initializeManagerDatabase("widnes-vikings", "Test Manager");
const champComp = state.competitions["championship"];

assert(champComp.clubIds.length === 12, "Manager Mode Championship has 12 playable clubs");
assert(champComp.fixtures.length === (12 * 22) / 2, "Exact 132 league fixtures for 22 rounds");
assert(champComp.standings.length === 12, "12 standings rows initialized");

// Validate Championship Club Squads
for (const clubId of champComp.clubIds) {
  const club = state.clubs[clubId];
  assert(!!club, `Club ${clubId} exists in Manager Mode universe`);
  const clubPlayers = Object.values(state.players).filter((p) => p.clubId === clubId);
  assert(clubPlayers.length >= 20, `Club ${club.name} has at least 20 players (${clubPlayers.length})`);
  assert(
    clubPlayers.some((p) => p.squadTier === "first"),
    `Club ${club.name} has first team players`
  );
  assert(
    clubPlayers.some((p) => p.squadTier === "reserves"),
    `Club ${club.name} has reserves players`
  );
  assert(
    clubPlayers.some((p) => p.squadTier === "academy"),
    `Club ${club.name} has academy players`
  );
}

if (failures > 0) {
  console.error(`\nValidation finished with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log("\nAll Championship validation checks passed successfully!");
}
