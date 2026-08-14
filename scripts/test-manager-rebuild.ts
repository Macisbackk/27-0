/**
 * Manager Mode rebuild validation: sacking gone, prom/rel cases, transfer identity.
 * Run: npx tsx scripts/test-manager-rebuild.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { applyPromotionRelegation } from "../src/lib/manager/managerSeasonTransition";
import { evaluateBoardSeason, wasManagerSacked } from "../src/lib/manager/boardSeasonEvaluation";
import { deriveCompetitionPhase } from "../src/lib/manager/competitionPhase";
import { getTableZone } from "../src/lib/manager/tableZones";
import { createChampionshipPlayoffs } from "../src/lib/manager/managerChampionshipPlayoffs";
import { getTransferWatchlistIds } from "../src/lib/manager/managerWatchlist";
import { transferLeaguePlayer } from "../src/lib/manager/managerLeagueRosters";
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

function row(
  team: string,
  position: number,
  played: number,
  isUser: boolean
) {
  return {
    team,
    played,
    wins: played - position + 1,
    draws: 0,
    losses: position - 1,
    pointsFor: 600 - position * 10,
    pointsAgainst: 200 + position * 10,
    pointsDifference: 400 - position * 20,
    leaguePoints: (played - position + 1) * 2,
    position,
    isUserTeam: isUser,
  };
}

function seedTables(
  career: ManagerCareer,
  slOrder: string[],
  champOrder: string[]
): ManagerCareer {
  const userInChamp =
    career.userCompetitionId === "championship" ||
    (champOrder.includes(career.club) && !slOrder.includes(career.club));
  const slRows = slOrder.map((team, i) =>
    row(team, i + 1, 27, team === career.club)
  );
  const champRows = champOrder.map((team, i) =>
    row(team, i + 1, 26, team === career.club)
  );
  return {
    ...career,
    isSeasonComplete: true,
    competitionPhase: "SEASON_TRANSITION_READY",
    leagueTable: userInChamp ? champRows : slRows,
    aiSuperLeagueStandings: slRows,
    championshipCompetition: {
      ...(career.championshipCompetition as NonNullable<
        ManagerCareer["championshipCompetition"]
      >),
      standings: champRows,
    },
  };
}

console.log("Sacking removed\n");
const career = createNewCareer("Leeds Rhinos");
assert(wasManagerSacked(career) === false, "wasManagerSacked is always false");
const poor = evaluateBoardSeason({
  ...career,
  boardConfidence: 5,
  wins: 1,
  losses: 26,
  isSeasonComplete: true,
  leagueTable: career.leagueTable.map((row) =>
    row.isUserTeam
      ? { ...row, position: 12, played: 27, won: 1, lost: 26, points: 2 }
      : row
  ),
});
assert(poor.finalDecision === "retain", "poor season still retains the manager");

console.log("\nTable zones\n");
assert(getTableZone("championship", 1).kind === "auto-promote", "Champ 1 auto-promote");
assert(getTableZone("championship", 3).kind === "playoffs", "Champ 3 playoffs");
assert(getTableZone("super-league", 11, 12).kind === "mpg", "SL 11 MPG");
assert(getTableZone("super-league", 12, 12).kind === "auto-relegate", "SL 12 auto-relegate");

console.log("\nChampionship playoffs exclude 1st\n");
const champCareer = createNewCareer("Bradford Bulls");
const sl = [...(champCareer.superLeagueClubNames ?? [])];
const champ = [...(champCareer.championshipClubNames ?? [])];
const champSeeded = seedTables(
  {
    ...champCareer,
    leagueTable: champ.map((team, i) => ({
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
      isUserTeam: team === champCareer.club,
    })),
  },
  sl,
  champ
);
const bracket = createChampionshipPlayoffs(champSeeded);
const poTeams = bracket.matches
  .filter((m) => m.round === 1)
  .flatMap((m) => [m.homeTeam, m.awayTeam]);
assert(!poTeams.includes(champ[0]!), "Champ 1st excluded from playoffs");
assert(poTeams.includes(champ[1]!), "Champ 2nd in playoffs");

console.log("\nPromotion / relegation cases\n");

function membership(result: ReturnType<typeof applyPromotionRelegation>) {
  const slClubs = result.career.superLeagueClubNames ?? [];
  const champClubs = result.career.championshipClubNames ?? [];
  const overlap = slClubs.filter((c) => champClubs.includes(c));
  return { slClubs, champClubs, overlap };
}

// Case 1: Champ 1st auto promote, SL 12th auto relegate, MPG champ wins
const case1 = applyPromotionRelegation({
  ...seedTables(champCareer, sl, champ),
  millionPoundGame: {
    seasonYear: champCareer.seasonYear,
    slClub: sl[10]!,
    champClub: champ[1]!,
    homeClub: sl[10]!,
    winner: champ[1]!,
    loser: sl[10]!,
    status: "complete",
    userParticipating: false,
  },
});
const m1 = membership(case1);
assert(case1.promoted.includes(champ[0]!), "Case 1: Champ 1st auto-promoted");
assert(case1.promoted.includes(champ[1]!), "Case 2: Champ playoff/MPG winner promoted");
assert(case1.relegated.includes(sl[11]!), "Case 6: SL 12th auto-relegated");
assert(case1.relegated.includes(sl[10]!), "Case 5: SL 11th MPG loser relegated");
assert(m1.overlap.length === 0, "no club in both competitions");
assert(m1.slClubs.length === 12 || m1.slClubs.length === 14, "SL membership sized");
assert(!m1.slClubs.includes(sl[11]!), "SL 12th left Super League");
assert(m1.slClubs.includes(champ[0]!), "Champ 1st now in Super League");

// Case 3/4: MPG SL 11th wins — champ playoff winner stays down
const case3 = applyPromotionRelegation({
  ...seedTables(champCareer, sl, champ),
  millionPoundGame: {
    seasonYear: champCareer.seasonYear,
    slClub: sl[10]!,
    champClub: champ[1]!,
    homeClub: sl[10]!,
    winner: sl[10]!,
    loser: champ[1]!,
    status: "complete",
    userParticipating: false,
  },
});
assert(case3.promoted.includes(champ[0]!), "auto promote still happens");
assert(!case3.promoted.includes(champ[1]!), "Case 3: MPG loser stays Championship");
assert(case3.relegated.includes(sl[11]!), "SL 12th still auto-relegated");
assert(!case3.relegated.includes(sl[10]!), "Case 4: SL 11th MPG winner stays SL");

console.log("\nMulti-season membership\n");
let world = case1.career;
for (let i = 0; i < 3; i++) {
  const slNow = [...(world.superLeagueClubNames ?? [])];
  const champNow = [...(world.championshipClubNames ?? [])];
  world = applyPromotionRelegation({
    ...seedTables(world, slNow, champNow),
    millionPoundGame: {
      seasonYear: world.seasonYear + i,
      slClub: slNow[10]!,
      champClub: champNow[1]!,
      homeClub: slNow[10]!,
      winner: slNow[10]!,
      loser: champNow[1]!,
      status: "complete",
      userParticipating: false,
    },
  }).career;
}
const slFinal = world.superLeagueClubNames ?? [];
const champFinal = world.championshipClubNames ?? [];
assert(
  slFinal.filter((c) => champFinal.includes(c)).length === 0,
  "no dual membership after 3 seasons"
);
assert(
  new Set([...slFinal, ...champFinal]).size === slFinal.length + champFinal.length,
  "all clubs unique after consecutive transitions"
);

console.log("\nTransfer identity + watchlist\n");
const slCareer = createNewCareer("Wigan Warriors");
const rosterEntries = Object.entries(slCareer.leagueClubRosters ?? {}).filter(
  ([club, ids]) => club !== slCareer.club && ids.length > 0
);
const fromEntry = rosterEntries[0];
const toEntry = rosterEntries[1];
assert(Boolean(fromEntry && toEntry), "AI clubs have rosters");
if (fromEntry && toEntry) {
  const [fromClub, fromIds] = fromEntry;
  const [toClub] = toEntry;
  const playerId = fromIds[0]!;
  const watched = {
    ...slCareer,
    transferWatchlistIds: [playerId],
  };
  const moved = transferLeaguePlayer(watched, playerId, fromClub, toClub);
  assert(
    getTransferWatchlistIds(moved).includes(playerId),
    "watchlist still points at the same player id after a club move"
  );
  const fromHas = (moved.leagueClubRosters?.[fromClub] ?? []).includes(playerId);
  const toHas = (moved.leagueClubRosters?.[toClub] ?? []).includes(playerId);
  assert(!fromHas && toHas, "same player id left old club and joined new club");
}

console.log("\nCompetition phase\n");
assert(
  deriveCompetitionPhase(createNewCareer("St Helens")) === "REGULAR_SEASON_ACTIVE",
  "new career is regular season"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
