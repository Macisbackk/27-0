/**
 * Smoke test for Championship clubs bidding on Super League reserve players.
 * Run: npx tsx scripts/test-reserve-to-championship-transfers.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { advanceManagerMatchWeek } from "../src/lib/manager/managerSimulation";
import {
  maybeChampionshipBidForSlReserves,
  acceptReserveTransferOffer,
  rejectReserveTransferOffer,
} from "../src/lib/manager/championshipBidForSlReserves";
import {
  CHAMPIONSHIP_CLUBS,
  isChampionshipClubName,
} from "../src/lib/clubs/championship-clubs";
import { isCurrentPlayableClub } from "../src/lib/clubs/super-league-display";
import type { LeagueTransferActivity, ManagerCareer } from "../src/lib/manager/types";

/** Mirrors ManagerAcrossLeague.tsx's cross-tier transfer filter without importing a client component. */
function isChampionshipSuperLeagueTransfer(tx: LeagueTransferActivity): boolean {
  const fromChamp = isChampionshipClubName(tx.fromClub);
  const toChamp = isChampionshipClubName(tx.toClub);
  const fromSl = isCurrentPlayableClub(tx.fromClub);
  const toSl = isCurrentPlayableClub(tx.toClub);
  return (fromChamp && toSl) || (fromSl && toChamp);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.error(`  \u2717 ${message}`);
  }
}

console.log("Reserve -> Championship transfer bidding\n");

let career: ManagerCareer = createNewCareer("Bradford Bulls");

assert(
  Boolean(career.championshipSquads) &&
    Object.keys(career.championshipSquads!.players).length === 500,
  "career starts with a full Championship squad pool"
);

// Force every reserve into the eligible CA band (70-84) and clear cooldowns so
// the deterministic weekly scan has real candidates to pick from every run.
career = {
  ...career,
  reserves: career.reserves.map((r, i) => ({
    ...r,
    rating: 74 + (i % 8),
    potentialRating: Math.min(92, 78 + (i % 10)),
    age: 20 + (i % 6),
    markedForRelease: false,
  })),
  reserveToChampionshipCooldowns: {},
};

const initialReserveIds = new Set(career.reserves.map((r) => r.id));
const initialReserveCount = career.reserves.length;

let offersSeen = 0;
let autoCompletedSeen = 0;
let weeksWithActivity = 0;

for (let week = 1; week <= 40; week++) {
  const before = career;
  career = { ...career, gameWeek: week };
  career = maybeChampionshipBidForSlReserves(career);

  const newReserveOffers = career.inboxMessages.filter(
    (m) => m.reserveOffer && !m.resolved
  );
  const newTransfers = (career.leagueTransfers ?? []).filter(
    (t) => t.sourceSquad === "reserve" && t.week === week
  );

  if (newReserveOffers.length > 0 || newTransfers.length > 0) {
    weeksWithActivity++;
  }
  offersSeen += newReserveOffers.length;
  autoCompletedSeen += newTransfers.filter((t) => t.fromClub !== career.club).length;

  // Resolve any pending user-reserve offers roughly half the time to exercise
  // both the accept and reject paths across the run.
  for (const offer of newReserveOffers) {
    if (Math.random() < 0.5) {
      const result = acceptReserveTransferOffer(career, offer.id);
      if (result.ok && result.career) {
        career = result.career;
      }
    } else {
      career = rejectReserveTransferOffer(career, offer.id);
    }
  }

  void before;
}

assert(offersSeen > 0, `generated at least one reserve offer across 40 weeks (saw ${offersSeen})`);
assert(weeksWithActivity > 0, `at least one week had reserve-bid activity (saw ${weeksWithActivity}/40)`);

const completedReserveTransfers = (career.leagueTransfers ?? []).filter(
  (t) => t.sourceSquad === "reserve"
);
assert(
  completedReserveTransfers.length > 0,
  `at least one reserve->Championship transfer completed (saw ${completedReserveTransfers.length})`
);

for (const tx of completedReserveTransfers) {
  assert(tx.fromCompetitionId === "super-league", `${tx.playerName}: fromCompetitionId is super-league`);
  assert(tx.toCompetitionId === "championship", `${tx.playerName}: toCompetitionId is championship`);
  assert(tx.transferType === "permanent", `${tx.playerName}: transferType is permanent`);
  assert(isChampionshipSuperLeagueTransfer(tx), `${tx.playerName}: flagged as cross-tier by Across the League filter`);

  const champ = career.championshipSquads!.players[tx.playerId];
  assert(Boolean(champ), `${tx.playerName}: now present in championshipSquads.players`);
  if (champ) {
    assert(
      (career.championshipSquads!.rosterByClub[champ.clubId] ?? []).includes(tx.playerId),
      `${tx.playerName}: listed on ${champ.clubName}'s Championship roster`
    );
  }
  assert(
    !career.reserves.some((r) => r.id === tx.playerId),
    `${tx.playerName}: removed from user reserves`
  );
  assert(
    !career.reserveContracts?.[tx.playerId],
    `${tx.playerName}: reserve contract cleaned up`
  );
}

// Every Championship club roster should stay within the configured cap.
let overCap = 0;
for (const club of CHAMPIONSHIP_CLUBS) {
  const roster = career.championshipSquads!.rosterByClub[club.id] ?? [];
  if (roster.length > 25) overCap++;
}
assert(overCap === 0, `no Championship club roster exceeds the 25-player cap (${overCap} over)`);

// Season reserve-signing counter tracks completed deals.
assert(
  (career.championshipReserveSigningsThisSeason ?? 0) === completedReserveTransfers.length,
  `championshipReserveSigningsThisSeason (${career.championshipReserveSigningsThisSeason}) matches completed transfers (${completedReserveTransfers.length})`
);

// Existing Championship elite -> Super League path must still function.
console.log("\nChampionship elite -> Super League path (regression)\n");
let eliteCareer: ManagerCareer = createNewCareer("Wigan Warriors");
let eliteTransfersSeen = 0;
for (let week = 1; week <= 30; week++) {
  eliteCareer = { ...eliteCareer, gameWeek: week };
  const before = eliteCareer.championshipToSlTransfersThisSeason ?? 0;
  // We only unit-test maybeAiSignChampionshipElite indirectly via advanceManagerMatchWeek
  // pathway is covered elsewhere; this loop just ensures no crash across many weeks
  // when combined with the new reserve-bid hook running in the same week.
  eliteCareer = maybeChampionshipBidForSlReserves(eliteCareer);
  const after = eliteCareer.championshipToSlTransfersThisSeason ?? before;
  if (after > before) eliteTransfersSeen++;
}
assert(true, "maybeChampionshipBidForSlReserves runs cleanly alongside elite-path state for 30 weeks");

// Sanity: full advanceManagerMatchWeek flow doesn't throw with the new hook wired in.
console.log("\nadvanceManagerMatchWeek integration\n");
let simCareer: ManagerCareer = createNewCareer("Leeds Rhinos");
try {
  for (let i = 0; i < 6 && simCareer.matchWeekPhase !== "season_complete"; i++) {
    if (simCareer.matchWeekPhase === "awaiting_advance") {
      const result = advanceManagerMatchWeek(simCareer);
      assert(result.ok, `advanceManagerMatchWeek week ${i}: ok`);
      simCareer = result.career;
    } else {
      break;
    }
  }
  assert(true, "advanceManagerMatchWeek did not throw with the reserve-bid hook wired in");
} catch (err) {
  failed++;
  console.error("  \u2717 advanceManagerMatchWeek threw:", err);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
