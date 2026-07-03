import { createNewCareer } from "../src/lib/manager/managerState";
import { getUserPlayoffMatch } from "../src/lib/manager/managerPlayoffs";
import {
  RESERVE_SQUAD_MIN,
  RESERVE_WALKOVER_REASON,
  RESERVE_WALKOVER_SCORE,
  simulateReserveFixture,
} from "../src/lib/manager/managerReserves";
import { applyAttendancePerformanceDrift } from "../src/lib/manager/managerAttendance";
import type { PlayoffBracketState } from "../src/lib/game/playoff-bracket";
import type { MatchSimState } from "../src/lib/game/season-simulation";

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

const emptySimState = {} as MatchSimState;

console.log("Manager suggestions regression\n");

const gfBracket: PlayoffBracketState = {
  seed: "test-gf",
  leaguePosition: 1,
  userClub: "Bradford Bulls",
  userEliminated: false,
  tournamentComplete: false,
  finish: null,
  simState: emptySimState,
  matches: [
    {
      id: "gf-1",
      round: 3,
      slot: 1,
      homeTeam: "Bradford Bulls",
      awayTeam: "Wigan Warriors",
      isUserMatch: true,
      isNeutral: true,
      status: "ready",
      homeScore: null,
      awayScore: null,
      winner: null,
      loser: null,
      feederIds: null,
      userFixture: null,
      scoringDetail: null,
    },
  ],
};
const gfMatch = getUserPlayoffMatch(gfBracket);
assert(gfMatch?.opponent === "Wigan Warriors", "Grand Final opponent is not the user club");
assert(gfMatch?.isHome === false, "Neutral Grand Final is not a home fixture");

let career = createNewCareer("Bradford Bulls");
career = {
  ...career,
  reserves: career.reserves.slice(0, 10),
  leagueClubReserveCounts: {
    ...(career.leagueClubReserveCounts ?? {}),
    "Bradford Bulls": 10,
    "Leeds Rhinos": RESERVE_SQUAD_MIN,
  },
};
const walkover = simulateReserveFixture(career, 1, "Leeds Rhinos");
assert(walkover.userScore === 0, "Losing walkover scores 0 for user");
assert(walkover.oppScore === RESERVE_WALKOVER_SCORE, "Winning walkover scores 18 for opponent");
assert(walkover.walkoverReason === RESERVE_WALKOVER_REASON, "Walkover reason is set");
assert(RESERVE_SQUAD_MIN === 17, "Reserve minimum is 17");

const beforeFloor =
  career.attendanceData.attendanceFloor ?? career.attendanceData.baseAttendance;
const topTable = career.leagueTable.map((row) =>
  row.team === career.club
    ? { ...row, position: 1, won: 20, lost: 7, played: 27, points: 40 }
    : row
);
const drifted = applyAttendancePerformanceDrift(
  {
    ...career,
    leagueTable: topTable,
    fixtures:
      career.fixtures.length >= 27
        ? career.fixtures
        : (career.fixtures as typeof career.fixtures),
  },
  "season_end"
);
const afterFloor =
  drifted.attendanceData.attendanceFloor ?? drifted.attendanceData.baseAttendance;
assert(afterFloor >= beforeFloor, "Strong season does not lower attendance floor");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
