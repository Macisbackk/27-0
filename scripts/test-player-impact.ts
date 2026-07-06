/**
 * Season impact stat tests.
 * Run: npx tsx scripts/test-player-impact.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { developSquadAtSeasonEnd } from "../src/lib/manager/managerPlayerDevelopment";
import {
  computePlayerSeasonImpact,
  getPlayerSeasonImpact,
  isPoorSeasonImpact,
} from "../src/lib/manager/managerPlayerImpact";

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

console.log("Player season impact tests\n");

assert(
  computePlayerSeasonImpact({
    appearances: 20,
    tries: 10,
    form: 72,
    goals: 8,
    playerOfMatch: 2,
    teamGamesPlayed: 22,
  }) >= 65,
  "Strong season scores high impact"
);

assert(
  computePlayerSeasonImpact({
    appearances: 18,
    tries: 1,
    form: 38,
    goals: 0,
    playerOfMatch: 0,
    teamGamesPlayed: 22,
  }) < 45,
  "Poor form and low output scores low impact"
);

assert(isPoorSeasonImpact(38), "Impact below 42 is poor");

const career = createNewCareer("Leeds Rhinos");
const playerId = career.squad[0]!.playerId;
const badCareer = {
  ...career,
  squad: career.squad.map((ps) =>
    ps.playerId === playerId
      ? {
          ...ps,
          seasonAppearances: 20,
          seasonTries: 0,
          form: 35,
        }
      : ps
  ),
  playerSeasonStats: {
    ...career.playerSeasonStats,
    [playerId]: {
      playerId,
      appearances: 20,
      tries: 0,
      goals: 0,
      playerOfMatch: 0,
    },
  },
  teamSeasonStats: { ...career.teamSeasonStats, played: 22 },
};

const badImpact = getPlayerSeasonImpact(badCareer, playerId);
assert(badImpact < 42, "Integrated bad season yields poor impact");

const goodCareer = {
  ...career,
  squad: career.squad.map((ps) =>
    ps.playerId === playerId
      ? {
          ...ps,
          seasonAppearances: 22,
          seasonTries: 14,
          form: 78,
        }
      : ps
  ),
  playerSeasonStats: {
    ...career.playerSeasonStats,
    [playerId]: {
      playerId,
      appearances: 22,
      tries: 14,
      goals: 10,
      playerOfMatch: 3,
    },
  },
  teamSeasonStats: { ...career.teamSeasonStats, played: 24 },
  isSeasonComplete: true,
};

const { changes: goodChanges } = developSquadAtSeasonEnd(goodCareer);
const goodChange = goodChanges.find((c) => c.playerId === playerId);

const { changes: badChanges } = developSquadAtSeasonEnd({
  ...badCareer,
  isSeasonComplete: true,
});
const badChange = badChanges.find((c) => c.playerId === playerId);

assert(
  (goodChange?.delta ?? 0) >= (badChange?.delta ?? 0),
  "Good impact season develops better than poor impact season"
);

assert(
  (badChange?.delta ?? 0) <= 0,
  "Poor impact season does not gain rating"
);

assert(
  (goodChange?.delta ?? 0) >= 1 && (goodChange?.delta ?? 0) <= 3,
  "Strong season gains are capped and meaningful"
);

const poorTeamCareer = {
  ...badCareer,
  isSeasonComplete: true,
  leagueTable: badCareer.leagueTable.map((row) =>
    row.isUserTeam
      ? { ...row, position: 13, wins: 6, losses: 16, played: 22 }
      : row
  ),
  teamSeasonStats: { ...badCareer.teamSeasonStats, wins: 6, losses: 16, played: 22 },
};

const goodTeamCareer = {
  ...goodCareer,
  leagueTable: goodCareer.leagueTable.map((row) =>
    row.isUserTeam
      ? { ...row, position: 2, wins: 18, losses: 4, played: 22 }
      : row
  ),
  teamSeasonStats: { ...goodCareer.teamSeasonStats, wins: 18, losses: 4, played: 22 },
};

const poorTeamChange = developSquadAtSeasonEnd(poorTeamCareer).changes.find(
  (c) => c.playerId === playerId
);
const goodTeamChange = developSquadAtSeasonEnd(goodTeamCareer).changes.find(
  (c) => c.playerId === playerId
);

assert(
  (goodTeamChange?.delta ?? 0) >= (poorTeamChange?.delta ?? 0),
  "Good team season develops better than poor team season"
);

assert(
  badChange == null || (badChange.seasonImpact != null && badChange.seasonImpact < 42),
  "Poor impact stored when player appears in development review"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
