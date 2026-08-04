/**
 * Validate Championship expansion data: clubs, squads, cup structure, nationalities.
 * Run: npx tsx scripts/validate-championship.ts
 */
import { CHAMPIONSHIP_CLUBS } from "../src/lib/clubs/championship-clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import {
  CHAMP_NATIONALITY_QUOTA,
  generateChampionshipSquads,
  validateChampionshipSquadGeneration,
} from "../src/lib/manager/championship/championshipSquads";
import { getChampNamePoolSizes } from "../src/lib/manager/championship/championshipNamePools";
import {
  createExpandedChallengeCupBracket,
  isExpandedChallengeCup,
} from "../src/lib/manager/championship/championshipChallengeCup";
import { createChampionshipCompetition } from "../src/lib/manager/championship/championshipLeague";
import { getNrlClubByName } from "../src/lib/nrl/nrlClubs";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

assert(CHAMPIONSHIP_CLUBS.length === 20, "Exactly 20 Championship clubs");
const ids = new Set(CHAMPIONSHIP_CLUBS.map((c) => c.id));
assert(ids.size === 20, "Unique Championship club IDs");
assert(
  CHAMPIONSHIP_CLUBS.every((c) => c.abbreviation && c.abbreviation.length >= 2),
  "Every club has abbreviation"
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
assert(
  CHAMPIONSHIP_CLUBS.every((c) => c.managerSelectable === false),
  "Not manager-selectable"
);
assert(
  !CHAMPIONSHIP_CLUBS.some((c) => /featherstone/i.test(c.name)),
  "No Featherstone Rovers"
);

const pools = getChampNamePoolSizes();
assert(pools.ENG.first >= 200 && pools.ENG.last >= 500, "ENG name pools");
assert(pools.FRA.first >= 50 && pools.FRA.last >= 100, "FRA name pools");
assert(pools.AUS.first >= 100 && pools.AUS.last >= 200, "AUS name pools");
assert(pools.NZL.first >= 80 && pools.NZL.last >= 150, "NZL name pools");
assert(pools.SAM.first >= 50 && pools.SAM.last >= 80, "SAM name pools");
assert(pools.FJI.first >= 40 && pools.FJI.last >= 70, "FJI name pools");
assert(pools.TON.first >= 30 && pools.TON.last >= 60, "TON name pools");
assert(pools.PNG.first >= 25 && pools.PNG.last >= 50, "PNG name pools");

const squads = generateChampionshipSquads("validate-seed", 2026);
validateChampionshipSquadGeneration(squads.players, squads.rosterByClub);
assert(Object.keys(squads.players).length === 500, "500 generated players");

const codes: Record<string, number> = {};
for (const p of Object.values(squads.players)) {
  codes[p.nationalityCode] = (codes[p.nationalityCode] ?? 0) + 1;
}
for (const [code, expected] of Object.entries(CHAMP_NATIONALITY_QUOTA)) {
  assert(codes[code] === expected, `Nationality ${code} = ${expected}`);
}

const competition = createChampionshipCompetition("validate-seed", 2026);
assert(competition.clubIds.length === 20, "Championship schedule 20 clubs");
assert(
  competition.fixtures.length === 20 * 19 / 2,
  "190 Championship fixtures"
);
assert(competition.standings.length === 20, "20 standings rows");

const cup = createExpandedChallengeCupBracket("validate-cup", "Wigan Warriors");
assert(isExpandedChallengeCup(cup), "Expanded cup schema");
assert(
  cup.expandedMeta.schemaVersion === 4,
  "Expanded cup schemaVersion = 4"
);
assert(
  cup.expandedMeta.roundOneByes.length === 0,
  "0 Championship Round One byes (all Champ clubs play R1)"
);
assert(
  cup.expandedMeta.roundOneParticipants.length === 20,
  "20 Round One participants"
);
assert(
  cup.matches.filter((m) => m.round === 1).length === 10,
  "10 Round One ties"
);
assert(
  cup.matches.filter((m) => m.round === 2).length === 8,
  "8 Round Two ties"
);
assert(
  (cup.expandedMeta.roundTwoByes?.length ?? 0) === 8,
  "8 Super League Last-16 byes"
);
assert(
  cup.matches
    .filter((m) => m.round === 2 && (m.feederIds?.length ?? 0) === 1)
    .every((m) => m.homeTeam !== null && m.awayTeam === null),
  "R2 SL-vs-Champ feeder ties: fixed club home, TBD away from R1"
);
assert(
  cup.matches.filter((m) => m.round === 2 && (m.feederIds?.length ?? 0) === 2)
    .length === 2,
  "2 Round Two Champ-vs-Champ feeder ties"
);
assert(
  cup.matches.filter((m) => m.round === 3).length === 8,
  "8 Last 16 ties"
);
assert(CURRENT_PLAYABLE_CLUBS.length === 14, "14 Super League clubs");

const r2Teams = new Set<string>();
for (const m of cup.matches.filter((x) => x.round === 2)) {
  if (m.homeTeam) r2Teams.add(m.homeTeam);
  if (m.awayTeam) r2Teams.add(m.awayTeam);
}
// Round Two places 6 fixed Super League entrants; remaining sides are R1 winners.
assert(r2Teams.size === 6, `Round Two fixed teams = 6 (got ${r2Teams.size})`);

// Seeding check: Round One pairs best vs worst (seed 1 vs 20, …).
const r1 = cup.matches
  .filter((m) => m.round === 1)
  .sort((a, b) => a.slot - b.slot);
const order = cup.expandedMeta.roundOneParticipants;
assert(
  r1.length === 10 &&
    r1.every(
      (m, i) =>
        m.homeTeam === order[i] && m.awayTeam === order[19 - i]
    ),
  "Round One seeded 1v20 … 10v11"
);
for (const name of [...CHAMPIONSHIP_CLUBS.map((c) => c.name), ...CURRENT_PLAYABLE_CLUBS]) {
  assert(!getNrlClubByName(name), `No NRL club in cup pool: ${name}`);
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s)`);
  process.exit(1);
}
console.log("\nChampionship validation passed.");
