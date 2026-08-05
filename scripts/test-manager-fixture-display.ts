/**
 * Competition label smoke tests.
 * Run: npx tsx scripts/test-manager-fixture-display.ts
 */

import {
  getManagerCompetitionLabel,
  getManagerCompetitionName,
  getManagerCupRoundLabel,
  getManagerFixtureSectionLabel,
  getManagerLeagueRoundLabel,
  getManagerPlayedFixtureLabel,
  getManagerScheduledFixtureHeadline,
  MANAGER_COMPETITION_NAMES,
} from "../src/lib/manager/managerFixtureDisplay";

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

console.log("managerFixtureDisplay labels\n");

assert(
  getManagerLeagueRoundLabel(5, "manager-primary") === "Round 5",
  "manager-primary league round omits trailing League"
);
assert(
  getManagerLeagueRoundLabel(5, "cross-tier") === "Round 5 — League",
  "cross-tier league round keeps League suffix"
);
assert(
  getManagerScheduledFixtureHeadline({ competition: "league", round: 3 }) ===
    "Round 3",
  "scheduled league headline is concise in manager context"
);
assert(
  getManagerPlayedFixtureLabel({ competition: "league", round: 7 }) ===
    "Round 7",
  "played league label is concise in manager context"
);
assert(
  getManagerFixtureSectionLabel("league", 12) === "League fixtures (12)",
  "fixture section drops Super League prefix in manager context"
);
assert(
  getManagerFixtureSectionLabel("league", 12, "cross-tier") ===
    `${MANAGER_COMPETITION_NAMES.superLeague} fixtures (12)`,
  "fixture section keeps Super League in cross-tier context"
);
assert(
  getManagerCompetitionName("league", { context: "manager-primary" }) === null,
  "league competition name omitted in manager-primary context"
);
assert(
  getManagerCompetitionName("league", { context: "cross-tier" }) ===
    MANAGER_COMPETITION_NAMES.superLeague,
  "league competition name shown in cross-tier context"
);
assert(
  getManagerCompetitionLabel("playoffs") === "Play-Offs",
  "playoffs label unchanged"
);
assert(
  getManagerScheduledFixtureHeadline({
    competition: "challenge_cup",
    round: 1,
    cupRound: "quarter_final",
  }) === getManagerCupRoundLabel("quarter_final"),
  "cup headline uses round label"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
