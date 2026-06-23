/**
 * Smoke tests for Super League play-off bracket logic.
 * Run: npm run test:playoffs
 */
import { buildLeagueTable } from "../src/lib/game/league-table";
import {
  simulatePlayoffs,
  userQualifiedForPlayoffs,
  PLAYOFF_QUALIFIERS,
} from "../src/lib/game/playoff-simulation";
import type { SeasonResult } from "../src/lib/game/season-simulation";
import type { SquadSlot } from "../src/lib/types";

function mockSeasonResult(
  wins: number,
  losses: number,
  leaguePosition: number
): SeasonResult {
  return {
    wins,
    losses,
    pointsFor: wins * 20,
    pointsAgainst: losses * 18,
    pointsDifference: wins * 20 - losses * 18,
    leaguePosition,
    isPerfect: losses === 0,
    longestWinStreak: wins,
    longestLosingStreak: losses,
    gameResults: [],
    fixtures: [],
    squadStrength: 80,
    tryScorers: [],
    insights: [],
    replacedTeam: "London Broncos",
  };
}

function emptySquad(): SquadSlot[] {
  return Array.from({ length: 13 }, (_, i) => ({
    slotIndex: i,
    position: "PROP",
    player: null,
  })) as SquadSlot[];
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

const seed = "playoff-test-seed";
const squad = emptySquad();

for (let position = 1; position <= PLAYOFF_QUALIFIERS; position++) {
  const season = mockSeasonResult(20, 7, position);
  const table = buildLeagueTable(season, `${seed}-pos-${position}`);
  const userPos =
    table.find((row) => row.isUserTeam)?.position ?? position;
  assert(
    userQualifiedForPlayoffs(userPos),
    `Position ${position} qualifies for play-offs`
  );
}

assert(!userQualifiedForPlayoffs(7), "Position 7 misses play-offs");

const missed = mockSeasonResult(10, 17, 7);

const first = simulatePlayoffs(
  squad,
  `${seed}-1st`,
  1,
  buildLeagueTable(mockSeasonResult(22, 5, 1), `${seed}-1st`)
);
assert(first.rounds.some((r) => r.round === "Semi Final"), "1st gets semi bye");
assert(
  !first.rounds.some((r) => r.round === "Eliminator" && r.userPlayed),
  "1st skips eliminator"
);

const third = simulatePlayoffs(
  squad,
  `${seed}-3rd`,
  3,
  buildLeagueTable(mockSeasonResult(19, 8, 3), `${seed}-3rd`)
);
assert(
  third.rounds[0]?.round === "Eliminator" && third.rounds[0]?.userPlayed,
  "3rd plays eliminator vs 6th"
);

const fourth = simulatePlayoffs(
  squad,
  `${seed}-4th`,
  4,
  buildLeagueTable(mockSeasonResult(18, 9, 4), `${seed}-4th`)
);
assert(
  fourth.rounds[0]?.opponent !== "",
  "4th plays eliminator opponent"
);

const missedResult = simulatePlayoffs(
  squad,
  `${seed}-missed`,
  7,
  buildLeagueTable(missed, `${seed}-missed`)
);
assert(
  missedResult.finish === "Missed Play-Offs",
  "7th receives Missed Play-Offs finish"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
