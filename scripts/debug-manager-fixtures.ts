/**
 * Debug Manager Mode fixture competition grouping.
 *
 * Usage:
 *   npm run debug:manager-fixtures
 */
import type { ManagerCompetition } from "../src/lib/manager/types";

type SampleFixture = {
  id: string;
  competition: ManagerCompetition;
  opponent: string;
  label?: string;
};

const SAMPLES: SampleFixture[] = [
  { id: "league-r1", competition: "league", opponent: "Wigan Warriors" },
  { id: "cup-r16", competition: "challenge_cup", opponent: "Leeds Rhinos", label: "Challenge Cup" },
  { id: "wcc-2028", competition: "world_club_challenge", opponent: "Melbourne Storm", label: "World Club Challenge" },
  { id: "playoff-sf", competition: "playoffs", opponent: "St Helens" },
  { id: "bad-wcc", competition: "world_club_challenge", opponent: "Bradford Bulls", label: "World Club Challenge" },
];

const NRL = new Set([
  "Brisbane Broncos",
  "Canberra Raiders",
  "Canterbury-Bankstown Bulldogs",
  "Cronulla Sharks",
  "Dolphins",
  "Gold Coast Titans",
  "Manly Sea Eagles",
  "Melbourne Storm",
  "Newcastle Knights",
  "North Queensland Cowboys",
  "Parramatta Eels",
  "Penrith Panthers",
  "South Sydney Rabbitohs",
  "St George Illawarra Dragons",
  "Sydney Roosters",
  "New Zealand Warriors",
  "Wests Tigers",
  "Perth Bears",
  "PNG Chiefs",
]);

const SUPER_LEAGUE = new Set([
  "Bradford Bulls",
  "Wigan Warriors",
  "Leeds Rhinos",
  "St Helens",
  "Hull FC",
  "Hull KR",
  "Warrington Wolves",
  "Catalans Dragons",
  "Salford Red Devils",
  "Leigh Leopards",
  "Huddersfield Giants",
  "Castleford Tigers",
  "Wakefield Trinity",
  "York Knights",
]);

function sectionFor(competition: ManagerCompetition): string {
  if (competition === "world_club_challenge") return "wcc";
  if (competition === "challenge_cup") return "cup";
  if (competition === "playoffs") return "playoffs";
  if (competition === "friendly") return "friendly";
  return "league";
}

function main() {
  console.log("=== Manager fixtures debug ===\n");

  const groups: Record<string, SampleFixture[]> = {
    league: [],
    cup: [],
    wcc: [],
    playoffs: [],
    friendly: [],
  };

  let warnings = 0;
  let expectedInvalidCaught = false;

  for (const f of SAMPLES) {
    const section = sectionFor(f.competition);
    groups[section]!.push(f);

    if (f.competition === "challenge_cup" && section !== "cup") {
      console.error(`FAIL: Challenge Cup fixture ${f.id} in section ${section}`);
      warnings++;
    }
    if (f.competition === "world_club_challenge" && section !== "wcc") {
      console.error(`FAIL: WCC fixture ${f.id} in section ${section}`);
      warnings++;
    }
    if (
      f.competition === "world_club_challenge" &&
      (!NRL.has(f.opponent) || SUPER_LEAGUE.has(f.opponent))
    ) {
      console.log(
        `OK: validation would reject invalid NRL opponent on ${f.id} ("${f.opponent}")`
      );
      expectedInvalidCaught = true;
    }
  }

  for (const [section, fixtures] of Object.entries(groups)) {
    console.log(`## ${section}`);
    if (fixtures.length === 0) {
      console.log("  (none)");
    } else {
      for (const f of fixtures) {
        console.log(`  ${f.id} · ${f.competition} · vs ${f.opponent}`);
      }
    }
    console.log("");
  }

  // Cross-contamination checks
  for (const f of groups.wcc ?? []) {
    if (f.competition !== "world_club_challenge") {
      console.error(`FAIL: non-WCC fixture in WCC section: ${f.id}`);
      warnings++;
    }
  }
  for (const f of groups.cup ?? []) {
    if (f.competition !== "challenge_cup") {
      console.error(`FAIL: non-cup fixture in Cup section: ${f.id}`);
      warnings++;
    }
  }

  if (!expectedInvalidCaught) {
    console.error("FAIL: expected invalid WCC opponent sample was not detected");
    warnings++;
  }

  if (warnings === 0) {
    console.log("Fixtures debug passed.");
  } else {
    console.log(`Fixtures debug finished with ${warnings} failure(s).`);
    process.exitCode = 1;
  }
}

main();
