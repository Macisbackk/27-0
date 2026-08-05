/**
 * Regression cover for league-phase completion and season trophies.
 *
 * Hydration falls back to `schedule: []`, so `currentFixtureIndex >= schedule.length`
 * evaluated 0 >= 0 and reported a brand-new career as league-complete. That handed
 * League Leaders (plus the board mail, celebration modal and lifetime stat) to
 * whichever club topped the all-zero table on the alphabetical tie-break.
 *
 * Run: npx tsx scripts/test-season-phase-complete.ts
 */
import assert from "node:assert/strict";
import { isLeagueAndCupPhaseComplete } from "../src/lib/manager/managerChallengeCup";
import { getManagerSeasonTrophyLabels } from "../src/lib/manager/managerSeasonTrophies";
import { MANAGER_SEASON_GAMES } from "../src/lib/manager/types";
import type {
  ManagerCareer,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "../src/lib/manager/types";

let checks = 0;
function check(label: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

function scheduledFixture(round: number): ManagerScheduledFixture {
  return {
    id: `r${round}`,
    round,
    opponent: "Wigan Warriors",
    competition: "league",
    isHome: round % 2 === 0,
  } as ManagerScheduledFixture;
}

function leagueResult(round: number): ManagerFixtureRecord {
  return {
    fixtureId: `r${round}`,
    round,
    opponent: "Wigan Warriors",
    competition: "league",
    result: "W",
    teamScore: 24,
    opponentScore: 12,
  } as unknown as ManagerFixtureRecord;
}

const CLUB = "Castleford Tigers";

/** Minimal bracket so cup-outcome derivation has a userClub to read. */
function emptyCupBracket(club: string, tournamentComplete = false) {
  return {
    userClub: club,
    matches: [],
    userEliminated: false,
    tournamentComplete,
    userWon: false,
  };
}

const CUP_ROUNDS = [
  "round_one",
  "round_two",
  "last_sixteen",
  "quarter_final",
  "semi_final",
  "final",
] as const;

/** A played-out cup run; the bracket reconciles to "settled" from these. */
function cupRun(): ManagerFixtureRecord[] {
  return CUP_ROUNDS.map(
    (cupRound, i) =>
      ({
        fixtureId: `cup-${cupRound}`,
        round: i + 1,
        opponent: "Hull FC",
        competition: "challenge_cup",
        // Beaten in the final — settles the cup without awarding it.
        result: cupRound === "final" ? "L" : "W",
        teamScore: cupRound === "final" ? 10 : 30,
        opponentScore: cupRound === "final" ? 20 : 6,
        meta: { cupRound },
      }) as unknown as ManagerFixtureRecord
  );
}

/** League phase completion also requires the cup to be settled. */
function fullLeagueSeason(): Partial<ManagerCareer> {
  return {
    schedule: Array.from({ length: MANAGER_SEASON_GAMES }, (_, i) =>
      scheduledFixture(i + 1)
    ),
    fixtures: [
      ...Array.from({ length: MANAGER_SEASON_GAMES }, (_, i) =>
        leagueResult(i + 1)
      ),
      ...cupRun(),
    ],
    currentFixtureIndex: MANAGER_SEASON_GAMES,
  };
}

/** Club sits top of an otherwise untouched table — the alphabetical tie-break case. */
function tableToppedBy(club: string) {
  return [
    {
      team: club,
      position: 1,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDifference: 0,
      leaguePoints: 0,
      isUserTeam: true,
    },
  ];
}

function careerWith(overrides: Partial<ManagerCareer>): ManagerCareer {
  return {
    club: CLUB,
    seasonYear: 2026,
    schedule: [],
    fixtures: [],
    roundMatches: [],
    currentFixtureIndex: 0,
    isSeasonComplete: false,
    playoffsIntroAcknowledged: false,
    playoffs: undefined,
    challengeCup: emptyCupBracket(CLUB),
    leagueTable: tableToppedBy(CLUB),
    matchdayXiii: [],
    matchdayInterchange: [],
    squad: [],
    ...overrides,
  } as unknown as ManagerCareer;
}

console.log("Season phase completion");

check("an unbuilt schedule is not a completed league phase", () => {
  const career = careerWith({ schedule: [], currentFixtureIndex: 0 });
  assert.equal(isLeagueAndCupPhaseComplete(career), false);
});

check("an unbuilt schedule with no cup bracket is not complete", () => {
  /* The exact hydration shape that caused this: `schedule: []` plus a missing
     bracket short-circuited straight to "league and cup finished". */
  const career = careerWith({
    schedule: [],
    currentFixtureIndex: 0,
    challengeCup: undefined as unknown as ManagerCareer["challengeCup"],
  });
  assert.equal(isLeagueAndCupPhaseComplete(career), false);
});

check("a fresh season with a full schedule is not complete", () => {
  const schedule = Array.from({ length: MANAGER_SEASON_GAMES }, (_, i) =>
    scheduledFixture(i + 1)
  );
  const career = careerWith({ schedule, currentFixtureIndex: 0 });
  assert.equal(isLeagueAndCupPhaseComplete(career), false);
});

check("an exhausted schedule with no matches played is not complete", () => {
  const career = careerWith({ schedule: [], currentFixtureIndex: 5 });
  assert.equal(isLeagueAndCupPhaseComplete(career), false);
});

check("a full league season is complete", () => {
  const career = careerWith(fullLeagueSeason());
  assert.equal(isLeagueAndCupPhaseComplete(career), true);
});

check("a short but exhausted schedule with results played is complete", () => {
  const career = careerWith({
    schedule: [scheduledFixture(1), scheduledFixture(2)],
    fixtures: [leagueResult(1), leagueResult(2), ...cupRun()],
    currentFixtureIndex: 2,
  });
  assert.equal(isLeagueAndCupPhaseComplete(career), true);
});

console.log("\nSeason trophies");

check("no League Leaders before a ball is kicked", () => {
  const career = careerWith({ schedule: [], fixtures: [] });
  assert.deepEqual(getManagerSeasonTrophyLabels(career), []);
});

check("stale playoff flags cannot award League Leaders with no results", () => {
  const career = careerWith({
    schedule: [],
    fixtures: [],
    isSeasonComplete: true,
    playoffsIntroAcknowledged: true,
  });
  assert.equal(
    getManagerSeasonTrophyLabels(career).includes("League Leaders"),
    false
  );
});

check("topping a settled table still awards League Leaders", () => {
  const career = careerWith(fullLeagueSeason());
  assert.equal(
    getManagerSeasonTrophyLabels(career).includes("League Leaders"),
    true
  );
});

console.log(`\n${checks} checks passed.`);
