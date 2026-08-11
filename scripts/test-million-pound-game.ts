/**
 * Smoke test for one-up/one-down + Million Pound Game membership swap.
 * Run: npx tsx scripts/test-million-pound-game.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { applyPromotionRelegation } from "../src/lib/manager/leagueMembership";
import {
  getAutoPromoteCount,
  getAutoRelegateCount,
  getLinkedPromoteRelegateCount,
} from "../src/lib/manager/managerLeagues";
import { MILLION_POUND_GAME_NAME } from "../src/lib/manager/managerMillionPoundGame";
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

console.log("Million Pound Game\n");

assert(getAutoPromoteCount() === 1, "auto promote count is 1");
assert(getAutoRelegateCount() === 1, "auto relegate count is 1");
assert(getLinkedPromoteRelegateCount() === 1, "linked swap count is 1");
assert(MILLION_POUND_GAME_NAME === "Million Pound Game", "exact MPG name");

const career = createNewCareer("Bradford Bulls");
const sl = [...(career.superLeagueClubNames ?? [])];
const champ = [...(career.championshipClubNames ?? [])];

const seeded: ManagerCareer = {
  ...career,
  leagueTable: sl.map((team, i) => ({
    team,
    played: 27,
    wins: 27 - i,
    draws: 0,
    losses: i,
    pointsFor: 600 - i * 10,
    pointsAgainst: 200 + i * 10,
    pointsDifference: 400 - i * 20,
    leaguePoints: (27 - i) * 2,
    position: i + 1,
    isUserTeam: team === career.club,
  })),
  championshipCompetition: {
    ...(career.championshipCompetition as NonNullable<
      ManagerCareer["championshipCompetition"]
    >),
    standings: champ.map((team, i) => ({
      team,
      played: 26,
      wins: 26 - i,
      draws: 0,
      losses: i,
      pointsFor: 500 - i * 8,
      pointsAgainst: 180 + i * 8,
      pointsDifference: 320 - i * 16,
      leaguePoints: (26 - i) * 2,
      position: i + 1,
      isUserTeam: false,
    })),
  },
  millionPoundGame: {
    seasonYear: career.seasonYear,
    slClub: sl[10]!,
    champClub: champ[1]!,
    homeClub: sl[10]!,
    winner: champ[1]!,
    loser: sl[10]!,
    status: "complete",
    userParticipating: false,
  },
};

const result = applyPromotionRelegation(seeded);
assert(result.promoted.includes(champ[0]!), "Champ 1st auto-promoted");
assert(result.promoted.includes(champ[1]!), "MPG winner promoted");
assert(result.relegated.includes(sl[11]!), "SL 12th auto-relegated");
assert(result.relegated.includes(sl[10]!), "MPG loser relegated");
assert(!result.promoted.includes(champ[2]!), "Champ 3rd not auto-promoted");
assert(
  result.career.inboxMessages.some((m) =>
    m.body?.includes(MILLION_POUND_GAME_NAME) || m.title?.includes("Promotion")
  ),
  "prom/rel inbox mentions promotion pathway"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
