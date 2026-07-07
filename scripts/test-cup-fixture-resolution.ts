/**
 * Regression tests: Challenge Cup fixtures must stay playable after squad auto-fix.
 * Run: npm run test:cup-fixtures
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { autoFixMatchdaySquad } from "../src/lib/manager/managerAutoFix";
import {
  createManagerChallengeCup,
  ensureCupBracketReady,
  getCupBracketDisplayRound,
  getPendingCupBracketRound,
  getUserCupMatch,
  prepareCupRound,
} from "../src/lib/manager/managerChallengeCup";
import {
  getNextManagerFixture,
  prepareCareerForNextMatch,
} from "../src/lib/manager/managerSimulation";
import type { ManagerCareer, ManagerFixtureRecord } from "../src/lib/manager/types";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";

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

function assertCupFixture(career: ManagerCareer, label: string): void {
  const pending = getPendingCupBracketRound(career);
  const fixture = getNextManagerFixture(career);
  const ok =
    pending === 1 &&
    fixture?.competition === "challenge_cup" &&
    !!fixture?.cupMatchId;
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
    return;
  }
  failed++;
  console.error(
    `  ✗ ${label} (pending=${pending}, fixture=${fixture?.competition ?? "null"}, cupMatchId=${fixture?.cupMatchId ?? "null"})`
  );
}

function leagueWin(career: ManagerCareer, round: number): ManagerCareer {
  const sched = career.schedule[career.currentFixtureIndex];
  if (!sched) return career;

  const record: ManagerFixtureRecord = {
    round,
    opponent: sched.opponent,
    isHome: sched.isHome,
    result: "W",
    pointsFor: 24,
    pointsAgainst: 12,
    triesFor: 4,
    triesAgainst: 2,
    scoringFor: { tries: 4, conversions: 4, penalties: 0, dropGoals: 0, points: 24 },
    scoringAgainst: { tries: 2, conversions: 2, penalties: 0, dropGoals: 0, points: 12 },
    isThrashing: false,
    isUpset: false,
    userClub: career.club,
    fixtureId: sched.id,
    competition: "league",
  };

  return {
    ...career,
    fixtures: [...career.fixtures, record],
    currentFixtureIndex: career.currentFixtureIndex + 1,
    gameWeek: round,
    wins: career.wins + 1,
  };
}

function playLeagueUntilCupTrigger(career: ManagerCareer, leagueGames: number): ManagerCareer {
  let next = career;
  for (let i = 0; i < leagueGames; i++) {
    if (next.currentFixtureIndex >= next.schedule.length) break;
    next = leagueWin(next, next.gameWeek + 1);
  }
  return next;
}

console.log("Challenge Cup fixture resolution tests\n");

function skipPreSeason(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    preSeason: {
      ...career.preSeason,
      friendliesPlayed: 2,
      awaitingChoice: false,
      currentChoices: [],
      activeFriendly: null,
    },
  };
}

const base = skipPreSeason(createNewCareer("Wigan Warriors"));
const afterFiveLeague = playLeagueUntilCupTrigger(base, 5);

assert(
  getPendingCupBracketRound(afterFiveLeague) === 1,
  "Cup round 1 unlocks after 5 league games"
);

const cupSynced = ensureCupBracketReady(afterFiveLeague);
const cupSyncedAgain = ensureCupBracketReady(cupSynced);
assert(
  cupSyncedAgain === cupSynced,
  "ensureCupBracketReady is idempotent once the bracket is prepared"
);
const cupFixture = getNextManagerFixture(cupSynced);

assert(cupFixture?.competition === "challenge_cup", "Next fixture is Challenge Cup");
assert(!!cupFixture?.cupMatchId, "Cup fixture includes bracket match id");

const displayRound = getCupBracketDisplayRound(cupSynced);
const futureComplete =
  cupSynced.challengeCup?.matches.filter(
    (m) => m.round > displayRound && m.status === "complete"
  ) ?? [];
assert(
  futureComplete.length === 0,
  "No future-round cup ties complete before user plays their first tie"
);

const overSimulatedCup = cupSynced.challengeCup!;
const legacyUnclipped = {
  ...cupSynced,
  challengeCup: {
    ...overSimulatedCup,
    matches: overSimulatedCup.matches.map((m) => {
      if (m.round < 3) return m;
      const winner = m.homeTeam ?? m.awayTeam;
      return {
        ...m,
        status: "complete" as const,
        homeScore: 24,
        awayScore: 12,
        winner,
        loser: m.homeTeam === winner ? m.awayTeam : m.homeTeam,
      };
    }),
  },
};
const repaired = ensureCupBracketReady(legacyUnclipped);
const futureAfterRepair =
  repaired.challengeCup?.matches.filter(
    (m) => m.round > displayRound && m.status === "complete"
  ) ?? [];
assert(
  futureAfterRepair.length === 0,
  "Legacy over-simulated bracket is clipped without spurious re-persist on repeat"
);
assert(
  ensureCupBracketReady(repaired) === repaired,
  "Repaired bracket is not rewritten on a second ensureCupBracketReady pass"
);

const autoFixed = autoFixMatchdaySquad(afterFiveLeague);
assert(autoFixed.ok, "Auto-fix succeeds for test squad");

const preparedOnly = ensureCupBracketReady(autoFixed.career);
const preparedFull = prepareCareerForNextMatch(afterFiveLeague);
const fixtureFromPrepared = getNextManagerFixture(preparedFull);

assert(
  preparedOnly.challengeCup !== autoFixed.career.challengeCup ||
    getPendingCupBracketRound(autoFixed.career) === null,
  "Cup bracket preparation can advance AI ties when needed"
);

assert(
  fixtureFromPrepared?.competition === "challenge_cup",
  "Prepared career still resolves a Challenge Cup fixture after auto-fix"
);

const brokenPersist = autoFixed.career;
const prepared = ensureCupBracketReady(brokenPersist);
assert(
  getNextManagerFixture(prepared)?.competition === "challenge_cup",
  "Cup fixture survives when only bracket-prepared career is used (regression for double-persist bug)"
);

const pending = getPendingCupBracketRound(prepared);
const userMatch =
  pending && prepared.challengeCup
    ? getUserCupMatch(prepared.challengeCup, pending)
    : null;
assert(!!userMatch, "User cup match is ready in bracket after preparation");

console.log("\nAll-club cup resolution after first trigger\n");
for (const club of CURRENT_PLAYABLE_CLUBS) {
  const clubCareer = playLeagueUntilCupTrigger(
    skipPreSeason(createNewCareer(club)),
    5
  );
  assertCupFixture(
    ensureCupBracketReady(clubCareer),
    `${club} resolves Challenge Cup fixture`
  );
}

console.log("\nQuarter-final bye regression\n");
let byeSeed: string | null = null;
for (let i = 0; i < 200; i++) {
  const seed = `cup-bye-regression-${i}`;
  const bracket = createManagerChallengeCup(seed, "Wigan Warriors");
  const hasRoundOneUserMatch = bracket.matches.some(
    (m) => m.round === 1 && m.isUserMatch
  );
  if (!hasRoundOneUserMatch) {
    byeSeed = seed;
    break;
  }
}
assert(!!byeSeed, "Found a QF-bye bracket seed for regression");

if (byeSeed) {
  let byeCareer = skipPreSeason(createNewCareer("Wigan Warriors"));
  byeCareer = {
    ...byeCareer,
    seed: byeSeed,
    id: byeSeed,
    challengeCup: createManagerChallengeCup(byeSeed, byeCareer.club),
  };
  byeCareer = playLeagueUntilCupTrigger(byeCareer, 5);

  const prepared = prepareCupRound(byeCareer);
  const userMatch = getUserCupMatch(prepared, 1);
  assert(
    !!userMatch && userMatch.round === 2,
    "QF-bye user match resolves in bracket round 2"
  );
  assertCupFixture(
    ensureCupBracketReady(byeCareer),
    "QF-bye club still gets Challenge Cup as next fixture"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
