/**
 * Monte Carlo: Championship seasons + expanded Challenge Cup.
 * Run: npx tsx scripts/monte-carlo-championship.ts
 * Optional: SEASONS=200 CUPS=200 npx tsx scripts/monte-carlo-championship.ts
 */
import { CHAMPIONSHIP_CLUB_NAMES } from "../src/lib/clubs/championship-clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import {
  advanceChampionshipToGameWeek,
  createChampionshipCompetition,
} from "../src/lib/manager/championship/championshipLeague";
import { createExpandedChallengeCupBracket } from "../src/lib/manager/championship/championshipChallengeCup";
import {
  generateChampionshipSquads,
  validateChampionshipSquadGeneration,
} from "../src/lib/manager/championship/championshipSquads";
import { maybeAiSignChampionshipElite } from "../src/lib/manager/championship/championshipAiTransfers";
import { finalizeBracketDisplay } from "../src/lib/game/challenge-cup-bracket";
import type { ManagerCareer } from "../src/lib/manager/types";

const SEASONS = Number(process.env.SEASONS ?? 1000);
const CUPS = Number(process.env.CUPS ?? 1000);
const TRANSFER_CAREERS = Number(process.env.TRANSFER_CAREERS ?? 200);

function pct(n: number, d: number): string {
  if (d === 0) return "0.0%";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1)))
  );
  return sorted[idx]!;
}

console.log(
  `\nChampionship Monte Carlo — ${SEASONS} seasons, ${CUPS} cups, ${TRANSFER_CAREERS} transfer careers\n`
);

// --- Squad generation sanity ---
let invalidSheets = 0;
const titleWins: Record<string, number> = {};
const championPoints: number[] = [];
const spoonPoints: number[] = [];
const allClubPoints: number[] = [];
let missingMatchDetail = 0;
let tryScorerMismatch = 0;
let fixturesPlayed = 0;

const t0 = Date.now();
for (let i = 0; i < SEASONS; i++) {
  const seed = `mc-champ-${i}`;
  const squads = generateChampionshipSquads(seed, 2026);
  try {
    validateChampionshipSquadGeneration(squads.players, squads.rosterByClub);
  } catch {
    invalidSheets++;
  }
  for (const clubId of Object.keys(squads.rosterByClub)) {
    const size = squads.rosterByClub[clubId]?.length ?? 0;
    if (size !== 25) invalidSheets++;
  }

  let competition = createChampionshipCompetition(seed, 2026);
  competition = advanceChampionshipToGameWeek(competition, 19, seed, squads);

  for (const f of competition.fixtures) {
    if (!f.played) continue;
    fixturesPlayed++;
    if (!f.matchDetail) {
      missingMatchDetail++;
      continue;
    }
    const homeTrySum = f.matchDetail.home.tryScorers.reduce(
      (s, x) => s + x.tries,
      0
    );
    const awayTrySum = f.matchDetail.away.tryScorers.reduce(
      (s, x) => s + x.tries,
      0
    );
    if (
      homeTrySum !== f.matchDetail.homeTries ||
      awayTrySum !== f.matchDetail.awayTries
    ) {
      tryScorerMismatch++;
    }
  }

  const table = competition.standings;
  const champ = table[0];
  const spoon = table[table.length - 1];
  if (champ) {
    titleWins[champ.team] = (titleWins[champ.team] ?? 0) + 1;
    championPoints.push(champ.leaguePoints);
  }
  if (spoon) spoonPoints.push(spoon.leaguePoints);
  for (const row of table) allClubPoints.push(row.leaguePoints);
}
const seasonMs = Date.now() - t0;

const titlesSorted = Object.entries(titleWins).sort((a, b) => b[1] - a[1]);
const ptsSorted = [...allClubPoints].sort((a, b) => a - b);

console.log("=== Championship seasons ===");
console.log(`Seasons:              ${SEASONS} (${seasonMs}ms)`);
console.log(`Invalid squad sheets: ${invalidSheets}`);
console.log(`Fixtures simulated:   ${fixturesPlayed}`);
console.log(`Missing match detail: ${missingMatchDetail}`);
console.log(`Try scorer mismatch:  ${tryScorerMismatch}`);
console.log(
  `Champion pts avg/p10/p90: ${avg(championPoints).toFixed(1)} / ${percentile([...championPoints].sort((a, b) => a - b), 10)} / ${percentile([...championPoints].sort((a, b) => a - b), 90)}`
);
console.log(
  `Spoon pts avg:          ${avg(spoonPoints).toFixed(1)}`
);
console.log(
  `All clubs pts p10/p50/p90: ${percentile(ptsSorted, 10)} / ${percentile(ptsSorted, 50)} / ${percentile(ptsSorted, 90)}`
);
console.log("Title share (top 8):");
for (const [club, wins] of titlesSorted.slice(0, 8)) {
  console.log(`  ${club.padEnd(28)} ${wins}  (${pct(wins, SEASONS)})`);
}
const neverTitle = CHAMPIONSHIP_CLUB_NAMES.filter((c) => !titleWins[c]);
if (neverTitle.length) {
  console.log(`Never champions (${neverTitle.length}): ${neverTitle.join(", ")}`);
}

// --- Challenge Cup ---
const t1 = Date.now();
let slWins = 0;
let champWins = 0;
let incompleteCups = 0;
const cupWinners: Record<string, number> = {};
const slSet = new Set<string>(CURRENT_PLAYABLE_CLUBS);
const champSet = new Set(CHAMPIONSHIP_CLUB_NAMES);

for (let i = 0; i < CUPS; i++) {
  const seed = `mc-cup-${i}`;
  let cup = createExpandedChallengeCupBracket(seed, "Wigan Warriors");
  cup = {
    ...cup,
    userClub: "__spectator__",
    matches: cup.matches.map((m) => ({ ...m, isUserMatch: false })),
  };
  const done = finalizeBracketDisplay(cup);
  const final = done.matches.find((m) => m.round === 6 && m.status === "complete");
  if (!final?.winner) {
    incompleteCups++;
    continue;
  }
  cupWinners[final.winner] = (cupWinners[final.winner] ?? 0) + 1;
  if (slSet.has(final.winner)) slWins++;
  else if (champSet.has(final.winner)) champWins++;
}
const cupMs = Date.now() - t1;
const cupWinnerList = Object.entries(cupWinners).sort((a, b) => b[1] - a[1]);

console.log("\n=== Expanded Challenge Cup ===");
console.log(`Cups:                 ${CUPS} (${cupMs}ms)`);
console.log(`Incomplete:           ${incompleteCups}`);
console.log(`Super League winners: ${slWins} (${pct(slWins, CUPS - incompleteCups)})`);
console.log(`Championship winners: ${champWins} (${pct(champWins, CUPS - incompleteCups)})`);
console.log("Most frequent winners (top 10):");
for (const [club, wins] of cupWinnerList.slice(0, 10)) {
  const tier = slSet.has(club) ? "SL" : "Champ";
  console.log(`  [${tier}] ${club.padEnd(28)} ${wins}  (${pct(wins, CUPS)})`);
}

// --- Champ → SL transfers ---
const t2 = Date.now();
const transferCounts: number[] = [];
for (let i = 0; i < TRANSFER_CAREERS; i++) {
  const seed = `mc-tx-${i}`;
  const squads = generateChampionshipSquads(seed, 2026);
  let career = {
    seed,
    seasonYear: 2026,
    gameWeek: 0,
    club: "Wigan Warriors",
    squad: [],
    reserves: [],
    youthProspects: [],
    freeAgents: [],
    championshipSquads: squads,
    championshipToSlTransfersThisSeason: 0,
    championshipTransferCooldowns: {},
    leagueClubRosters: {},
    leagueTransfers: [],
    latestNews: [],
    playerRegistry: {},
    inboxMessages: [],
  } as unknown as ManagerCareer;

  for (let week = 1; week <= 27; week++) {
    career = {
      ...career,
      gameWeek: week,
    };
    career = maybeAiSignChampionshipElite(career);
  }
  transferCounts.push(career.championshipToSlTransfersThisSeason ?? 0);
}
const txMs = Date.now() - t2;
const txSorted = [...transferCounts].sort((a, b) => a - b);

console.log("\n=== Championship → Super League transfers ===");
console.log(`Careers (27 weeks):   ${TRANSFER_CAREERS} (${txMs}ms)`);
console.log(
  `Transfers/season avg: ${avg(transferCounts).toFixed(2)} (target ~4–8)`
);
console.log(
  `p10 / p50 / p90:       ${percentile(txSorted, 10)} / ${percentile(txSorted, 50)} / ${percentile(txSorted, 90)}`
);
console.log(`Zero-transfer seasons: ${transferCounts.filter((n) => n === 0).length} (${pct(transferCounts.filter((n) => n === 0).length, TRANSFER_CAREERS)})`);

console.log("\nDone.\n");
