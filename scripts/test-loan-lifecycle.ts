/**
 * Loan lifecycle smoke tests.
 * Run: npx tsx scripts/test-loan-lifecycle.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import {
  listPlayerForLoanWithOffers,
} from "../src/lib/manager/managerTransferLeague";
import {
  completeIncomingLoan,
  completeOutgoingLoan,
  getActiveLoan,
  getLoanOutDestinationClubs,
  isPlayerAwayOnLoan,
  returnExpiredLoans,
} from "../src/lib/manager/managerLoans";
import { getPlayerRegistration } from "../src/lib/manager/playerRegistration";
import { assertSingleTransferState } from "../src/lib/manager/transferInvariants";
import { applyTransferTransaction } from "../src/lib/manager/transferTransactions";
import { findPlayerLeagueClub } from "../src/lib/manager/managerLeagueRosters";
import type { ManagerCareer } from "../src/lib/manager/types";
import { hydrateManagerCareer } from "../src/lib/manager/managerState";

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

console.log("Loan lifecycle\n");

let career: ManagerCareer = createNewCareer("St Helens");
const destinations = getLoanOutDestinationClubs(career);
assert(destinations.length > 0, "championship loan destinations exist");

const playerId = career.squad[3]?.playerId;
assert(Boolean(playerId), "has a squad player to loan");

if (playerId && destinations[0]) {
  const toClub = destinations[0];
  career = completeOutgoingLoan(career, playerId, toClub, {
    loanFee: 0,
    parentWageShare: 0.5,
    canRecall: true,
  });

  assert(isPlayerAwayOnLoan(career, playerId), "player marked away on loan");
  assert(
    !career.squad.some((p) => p.playerId === playerId),
    "loaned-out player removed from selectable squad"
  );
  assert(
    Boolean(career.contracts[playerId]),
    "parent contract retained during loan"
  );
  assert(
    findPlayerLeagueClub(career, playerId) === toClub,
    "playing registration is loanee club"
  );
  const reg = getPlayerRegistration(career, playerId);
  assert(
    reg.owningClubId === career.club && reg.playingClubId === toClub,
    "registration splits owning vs playing clubs"
  );
  assert(
    reg.registrationType === "LOAN",
    "registration type is LOAN"
  );

  // Save/reload mid-loan
  const reloaded = hydrateManagerCareer(
    JSON.parse(JSON.stringify(career)) as ManagerCareer
  );
  assert(
    Boolean(getActiveLoan(reloaded, playerId)),
    "active loan survives JSON round-trip"
  );

  // Cannot permanently sell while away — eligibility-style check via active loan
  assert(
    Boolean(getActiveLoan(career, playerId)),
    "loan still active before return"
  );

  career = {
    ...career,
    seasonYear: career.seasonYear,
  };
  career = returnExpiredLoans({
    ...career,
    // Force expiry path by matching endsAtSeasonYear
    activeLoans: (career.activeLoans ?? []).map((l) => ({
      ...l,
      endsAtSeasonYear: career.seasonYear,
    })),
  });

  assert(!getActiveLoan(career, playerId), "loan cleared after return");
  assert(
    career.squad.some((p) => p.playerId === playerId),
    "player returned to parent squad"
  );
  const inv = assertSingleTransferState(career, playerId);
  assert(inv.valid, `invariant after loan return (${inv.violations.join("; ")})`);
}

// Idempotent applyTransferTransaction for loan out
career = createNewCareer("Warrington Wolves");
const pid = career.squad[2]?.playerId;
const dest = getLoanOutDestinationClubs(career)[0];
if (pid && dest) {
  const txId = `test-loan-out-${pid}`;
  const first = applyTransferTransaction(career, {
    id: txId,
    type: "LOAN",
    playerId: pid,
    fromClubId: career.club,
    toClubId: dest,
    fee: 0,
    loanTerms: { direction: "out", parentWageShare: 0.5, canRecall: true },
  });
  assert(first.ok, "applyTransferTransaction loan out ok");
  const second = applyTransferTransaction(first.career, {
    id: txId,
    type: "LOAN",
    playerId: pid,
    fromClubId: career.club,
    toClubId: dest,
    fee: 0,
    loanTerms: { direction: "out", parentWageShare: 0.5, canRecall: true },
  });
  assert(second.alreadyProcessed === true, "second apply is idempotent");
  assert(
    (second.career.activeLoans ?? []).filter((l) => l.playerId === pid).length === 1,
    "loan not duplicated on re-apply"
  );
}

// List for loan generates loan offers, not permanent sales
career = createNewCareer("Leeds Rhinos");
const listId = career.squad[4]?.playerId;
if (listId) {
  career = listPlayerForLoanWithOffers(career, listId, 0);
  const offers = career.inboxMessages.filter(
    (m) => m.playerId === listId && !m.resolved
  );
  assert(
    offers.every((m) => m.loanOffer === true) || offers.length === 0,
    "list-for-loan does not create permanent sale offers"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
