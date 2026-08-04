/**
 * Boosts, board sackings, and club-change continuity checks.
 * Run: npx tsx scripts/test-boosts-and-sackings.ts
 */
import {
  STORE_BOOSTS,
  getManagerModeBoosts,
  getQuickModeBoosts,
  FINANCIAL_TAKEOVER_AMOUNT,
} from "../data/store-boosts";
import {
  buildBoostedPair,
  isGoatOrHallOfFamePlayer,
  isNinetyPlusPlayer,
  selectionHasBoostedPlayer,
} from "../src/lib/boosts/applyQuickModeBoost";
import { applyManagerBoost } from "../src/lib/boosts/applyManagerBoost";
import { createNewCareer } from "../src/lib/manager/managerState";
import {
  evaluateBoardSeason,
  getOrCreateBoardSeasonEvaluation,
} from "../src/lib/manager/boardSeasonEvaluation";
import { takeOverClub } from "../src/lib/manager/managerClubChange";
import { CURRENT_PLAYERS, LEGEND_PLAYERS } from "../src/lib/players";
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

console.log("Boost definitions\n");

assert(STORE_BOOSTS.length === 8, "exactly 8 store boosts");
assert(getQuickModeBoosts().length === 2, "exactly 2 Quick Mode boosts");
assert(getManagerModeBoosts().length === 6, "exactly 6 Manager boosts");
assert(
  getQuickModeBoosts().every((b) => b.category === "quick-mode"),
  "QM boosts are quick-mode category"
);
assert(
  getManagerModeBoosts().every((b) => b.category === "manager-mode"),
  "Manager boosts are manager-mode category"
);
assert(
  getQuickModeBoosts().every(
    (b) =>
      b.compatibleModes.includes("CLASSIC") &&
      !b.compatibleModes.includes("FANTASY")
  ),
  "QM boosts target Classic/Draft (not public Fantasy)"
);
assert(
  STORE_BOOSTS.find((b) => b.id === "qm-90-plus-player")?.price === 1_000_000,
  "90+ boost costs £1m"
);
assert(
  STORE_BOOSTS.find((b) => b.id === "qm-goat-hall-of-fame")?.price === 2_000_000,
  "GOAT/HOF boost costs £2m"
);
assert(
  STORE_BOOSTS.find((b) => b.id === "mgr-financial-takeover")?.price ===
    5_000_000,
  "Financial Takeover costs £5m"
);
assert(FINANCIAL_TAKEOVER_AMOUNT === 7_500_000, "Takeover injects £7.5m");

console.log("\nQuick Mode selection boost helpers\n");

const ninetyPlus = CURRENT_PLAYERS.filter(isNinetyPlusPlayer);
const goatHof = [...CURRENT_PLAYERS, ...LEGEND_PLAYERS].filter(
  isGoatOrHallOfFamePlayer
);
assert(ninetyPlus.length >= 2, `pool has 90+ players (${ninetyPlus.length})`);
assert(goatHof.length >= 2, `pool has GOAT/HOF players (${goatHof.length})`);

const boosted90 = buildBoostedPair({
  boostId: "qm-90-plus-player",
  eligiblePool: CURRENT_PLAYERS,
  usedIds: new Set(),
  pickRandom: (items) => items[0] ?? null,
});
assert(Boolean(boosted90.pair), "buildBoostedPair returns 90+ pair");
assert(
  boosted90.pair
    ? selectionHasBoostedPlayer(boosted90.pair, "qm-90-plus-player")
    : false,
  "90+ pair contains a 90+ player"
);

const boostedGoat = buildBoostedPair({
  boostId: "qm-goat-hall-of-fame",
  eligiblePool: [...CURRENT_PLAYERS, ...LEGEND_PLAYERS],
  usedIds: new Set(),
  pickRandom: (items) => items[0] ?? null,
});
assert(Boolean(boostedGoat.pair), "buildBoostedPair returns GOAT/HOF pair");
assert(
  boostedGoat.pair
    ? selectionHasBoostedPlayer(boostedGoat.pair, "qm-goat-hall-of-fame")
    : false,
  "GOAT/HOF pair contains eligible legend/HOF"
);

console.log("\nManager boosts + No Sacking\n");

let career = createNewCareer("Leeds Rhinos");
const beforeFinance =
  (career.managerFinance?.transferBudget ?? career.budget) +
  (career.managerFinance?.operatingBalance ?? 0);
const take = applyManagerBoost({
  boostId: "mgr-financial-takeover",
  career,
  usageId: "test-takeover-1",
});
assert(take.success && Boolean(take.career), "Financial Takeover applies");
career = take.career!;
const afterFinance =
  (career.managerFinance?.transferBudget ?? career.budget) +
  (career.managerFinance?.operatingBalance ?? 0);
assert(
  afterFinance >= beforeFinance + FINANCIAL_TAKEOVER_AMOUNT,
  "Financial Takeover increases club finances by £7.5m"
);

const protect = applyManagerBoost({
  boostId: "mgr-no-sacking",
  career,
  usageId: "test-nosack-1",
});
assert(protect.success && Boolean(protect.career), "No Sacking applies");
career = protect.career!;
assert(
  career.managerProtection?.noSacking === true,
  "No Sacking sets managerProtection.noSacking"
);

const failing: ManagerCareer = {
  ...career,
  boardConfidence: 10,
  wins: 2,
  losses: 25,
  isSeasonComplete: true,
  leagueTable: career.leagueTable.map((row) =>
    row.isUserTeam
      ? { ...row, position: 12, played: 27, won: 2, lost: 25, points: 4 }
      : row
  ),
};
const evalSack = evaluateBoardSeason({
  ...failing,
  managerProtection: undefined,
});
assert(evalSack.recommendation === "sack", "poor season recommends sack");
assert(evalSack.finalDecision === "sack", "unprotected finalDecision is sack");

const evalProtect = evaluateBoardSeason(failing);
assert(
  evalProtect.recommendation === "sack",
  "protected season still recommends sack internally"
);
assert(
  evalProtect.finalDecision === "retain",
  "No Sacking overrides finalDecision to retain"
);
assert(
  evalProtect.protectedByNoSacking === true,
  "protectedByNoSacking flag set"
);

const once = getOrCreateBoardSeasonEvaluation(failing);
const twice = getOrCreateBoardSeasonEvaluation({
  ...once.career,
  boardConfidence: 99,
});
assert(
  twice.evaluation.decisionId === once.evaluation.decisionId,
  "board evaluation persists once per season"
);

console.log("\nClub change continuity\n");

const reserveIds = career.reserves.map((r) => r.id).sort();
const seasonYear = career.seasonYear;
const gameWeek = career.gameWeek;
const otherClub =
  career.leagueTable.find((r) => !r.isUserTeam)?.team ?? "Wigan Warriors";

const left = takeOverClub(career, otherClub, "sacked");
assert(left.club === otherClub, `took over ${otherClub}`);
assert(left.seasonYear === seasonYear, "season year preserved");
assert(left.gameWeek === gameWeek, "game week preserved");
assert(
  (left.leagueClubReserves?.[career.club] ?? [])
    .map((r) => r.id)
    .sort()
    .join(",") === reserveIds.join(","),
  "previous club reserves snapshotted into leagueClubReserves"
);

const previousRoster = career.squad.map((p) => p.playerId).sort().join(",");
assert(
  (left.leagueClubRosters?.[career.club] ?? []).slice().sort().join(",") ===
    previousRoster,
  "previous club senior roster preserved for AI continuation"
);

const returned = takeOverClub(left, career.club, "club-change");
assert(returned.club === career.club, "returned to original club");
assert(
  returned.reserves
    .map((r) => r.id)
    .sort()
    .join(",") === reserveIds.join(","),
  "returning club inherits same reserve identities (not opening regen)"
);
assert(
  returned.seasonYear === seasonYear && returned.gameWeek === gameWeek,
  "world calendar unchanged after second club change"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
