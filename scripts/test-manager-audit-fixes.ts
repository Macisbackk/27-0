/**
 * Regression tests for manager mode audit fixes.
 * Run: npm run test:manager-audit
 */
import { createNewCareer, prepareManagerCareerForSave } from "../src/lib/manager/managerState";
import {
  isCupMatchReadyForResult,
  getPendingCupBracketRound,
  isLeagueAndCupPhaseComplete,
} from "../src/lib/manager/managerChallengeCup";
import { isManagerSeasonCompleteLite } from "../src/lib/manager/managerSimulation";
import { computeCareerWageBill } from "../src/lib/manager/managerReserveContracts";
import { syncManagerFinance } from "../src/lib/manager/managerFinance";
import { purgeStaleInboxMessages } from "../src/lib/manager/managerInbox";
import { acceptIncomingOffer, releasePlayerWithCost } from "../src/lib/manager/managerTransferLeague";
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

console.log("Manager audit fixes\n");

const career = createNewCareer("Bradford Bulls");
const reserveWages = Object.values(career.reserveContracts ?? {}).reduce(
  (sum, c) => sum + c.wagePerYear,
  0
);
const synced = syncManagerFinance(career);
assert(
  synced.wageBill >= reserveWages && synced.managerFinance!.wageBill === synced.wageBill,
  "syncManagerFinance includes reserve wages"
);

const saved = prepareManagerCareerForSave(career);
const cupMatchesBefore = career.challengeCup.matches.length;
const cupMatchesAfter = saved.challengeCup.matches.length;
assert(
  cupMatchesAfter === cupMatchesBefore,
  "prepareManagerCareerForSave does not reset cup bracket"
);

const pending = getPendingCupBracketRound(career);
if (pending !== null) {
  const cupMatch = career.challengeCup.matches.find(
    (m) => m.isUserMatch && m.round === pending
  );
  if (cupMatch) {
    assert(
      !isCupMatchReadyForResult(
        { ...career, challengeCup: { ...career.challengeCup, matches: career.challengeCup.matches.map((m) => m.id === cupMatch.id ? { ...m, status: "pending" as const } : m) } },
        cupMatch.id
      ),
      "isCupMatchReadyForResult rejects non-ready cup ties"
    );
  }
}

const staleInbox: ManagerCareer = {
  ...career,
  seasonYear: 2027,
  gameWeek: 2,
  inboxMessages: [
    {
      id: "old-season",
      type: "news",
      title: "Old",
      body: "Old",
      week: 20,
      season: 2026,
      gameWeek: 20,
      createdAt: new Date().toISOString(),
      read: true,
    },
    {
      id: "current",
      type: "news",
      title: "Current",
      body: "Current",
      week: 1,
      season: 2027,
      gameWeek: 1,
      createdAt: new Date().toISOString(),
      read: true,
    },
  ],
};
const purged = purgeStaleInboxMessages(staleInbox);
assert(
  purged.inboxMessages.some((m) => m.id === "current") &&
    !purged.inboxMessages.some((m) => m.id === "old-season"),
  "purgeStaleInboxMessages drops prior-season messages"
);

const squadPlayerId = career.squad[0]!.playerId;
const released = releasePlayerWithCost(career, squadPlayerId);
assert(released.ok === true && !!released.career, "releasePlayerWithCost succeeds");
if (released.career) {
  assert(
    !released.career.squad.some((p) => p.playerId === squadPlayerId),
    "releasePlayerWithCost removes player from squad"
  );
}

const offerCareer: ManagerCareer = {
  ...career,
  inboxMessages: [
    {
      id: "ghost-offer",
      type: "transfer_offer_in",
      title: "Offer",
      body: "Offer",
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      playerId: "nonexistent-player",
      offerAmount: 100_000,
      offerClub: "Leeds Rhinos",
    },
  ],
};
const rejected = acceptIncomingOffer(offerCareer, "ghost-offer");
assert(!rejected.ok, "acceptIncomingOffer rejects sold/released players");

const brokeBuyerCareer: ManagerCareer = {
  ...career,
  clubFunds: { ...career.clubFunds, "Leeds Rhinos": 10_000 },
  inboxMessages: [
    {
      id: "big-offer",
      type: "transfer_offer_in",
      title: "Offer",
      body: "Offer",
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      playerId: career.squad[1]!.playerId,
      offerAmount: 500_000,
      offerClub: "Leeds Rhinos",
    },
  ],
};
const brokeReject = acceptIncomingOffer(brokeBuyerCareer, "big-offer");
assert(!brokeReject.ok, "acceptIncomingOffer rejects insolvent buyers");

if (released.career) {
  assert(
    !!released.career.freeAgents?.some((f) => f.playerId === squadPlayerId),
    "releasePlayerWithCost adds player to free agents"
  );
}

const cupDoneCareer = {
  ...career,
  fixtures: [
    ...career.fixtures,
    ...Array.from({ length: 27 }, (_, i) => ({
      round: i + 1,
      opponent: "Hull FC",
      isHome: true,
      result: "W" as const,
      pointsFor: 20,
      pointsAgainst: 10,
      triesFor: 3,
      triesAgainst: 1,
      scoringFor: { tries: 3, conversions: 3, penalties: 0, dropGoals: 0, points: 20 },
      scoringAgainst: { tries: 1, conversions: 1, penalties: 0, dropGoals: 0, points: 10 },
      isThrashing: false,
      isUpset: false,
      userClub: career.club,
      fixtureId: `league-${i}`,
      competition: "league" as const,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      round: 28 + i,
      opponent: "Wigan Warriors",
      isHome: true,
      result: "W" as const,
      pointsFor: 20,
      pointsAgainst: 10,
      triesFor: 3,
      triesAgainst: 1,
      scoringFor: { tries: 3, conversions: 3, penalties: 0, dropGoals: 0, points: 20 },
      scoringAgainst: { tries: 1, conversions: 1, penalties: 0, dropGoals: 0, points: 10 },
      isThrashing: false,
      isUpset: false,
      userClub: career.club,
      fixtureId: `cup-${i}`,
      competition: "challenge_cup" as const,
      meta: {
        cupRound: (["round_one", "quarter_final", "semi_final", "final"] as const)[i],
        injuries: [],
      },
    })),
  ],
  currentFixtureIndex: 27,
  challengeCup: {
    ...career.challengeCup,
    tournamentComplete: false,
    userEliminated: false,
  },
} as ManagerCareer;
assert(
  isLeagueAndCupPhaseComplete(cupDoneCareer),
  "cup phase complete when four cup ties played despite stale bracket flags"
);

assert(
  typeof prepareManagerCareerForSave(career).isSeasonComplete === "boolean",
  "prepareManagerCareerForSave sets isSeasonComplete"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
