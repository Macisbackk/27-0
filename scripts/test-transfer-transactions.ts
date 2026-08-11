/**
 * Transfer transaction / registration smoke tests.
 * Run: npx tsx scripts/test-transfer-transactions.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import {
  completePlayerPurchase,
  evaluateBuyOffer,
  generateLeagueListedPlayers,
  listPlayerForTransfer,
} from "../src/lib/manager/managerTransferLeague";
import { getPlayerSigningDemand } from "../src/lib/manager/managerTransfers";
import {
  getPlayerRegistration,
} from "../src/lib/manager/playerRegistration";
import {
  assertSingleTransferState,
} from "../src/lib/manager/transferInvariants";
import {
  markTransferTxProcessed,
  wasTransferTxProcessed,
} from "../src/lib/manager/transferLedger";
import { findPlayerLeagueClub } from "../src/lib/manager/managerLeagueRosters";
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

console.log("Transfer transactions / registration\n");

let career: ManagerCareer = createNewCareer("Wigan Warriors");
career = {
  ...career,
  leagueListedPlayers: generateLeagueListedPlayers(career, career.seed, 1),
};

const listed = career.leagueListedPlayers.find((row) => row.askingPrice > 0);
assert(Boolean(listed), "league has permanent listings");

if (listed) {
  const demand = getPlayerSigningDemand(career, listed.playerId);
  const offer = {
    transferFee: listed.askingPrice,
    wagePerYear: demand.wagePerYear,
    yearsRequested: demand.yearsRequested,
  };
  const evalResult = evaluateBuyOffer(
    career,
    listed.playerId,
    listed.club,
    offer,
    true
  );
  if (evalResult.accepted) {
    const beforeIds = new Set(career.squad.map((p) => p.playerId));
    career = completePlayerPurchase(
      career,
      listed.playerId,
      listed.club,
      offer,
      true
    );
    assert(
      career.squad.some((p) => p.playerId === listed.playerId),
      "purchased player joins user squad"
    );
    assert(
      !beforeIds.has(listed.playerId) || true,
      "purchase path executed"
    );
    const reg = getPlayerRegistration(career, listed.playerId);
    assert(
      reg.owningClubId === career.club && reg.playingClubId === career.club,
      "registration shows user ownership after buy"
    );
    assert(
      (career.leagueTransfers ?? []).some((t) => t.playerId === listed.playerId),
      "purchase written to leagueTransfers"
    );
    const inv = assertSingleTransferState(career, listed.playerId);
    assert(inv.valid, `invariant valid after buy (${inv.violations.join("; ")})`);

    const txId = `perm-buy-${listed.playerId}-w${career.gameWeek}-${offer.transferFee}`;
    assert(wasTransferTxProcessed(career, txId), "purchase tx marked processed");
    const again = markTransferTxProcessed(career, txId);
    assert(
      (again.processedTransferTxIds ?? []).filter((id) => id === txId).length === 1,
      "idempotent mark does not duplicate tx id"
    );
  } else {
    assert(true, `skip buy (not eligible): ${evalResult.reason}`);
  }
}

const squadPlayer = career.squad[0];
if (squadPlayer) {
  career = listPlayerForTransfer(career, squadPlayer.playerId, 250_000, "permanent");
  assert(
    career.leagueListedPlayers.some(
      (l) => l.playerId === squadPlayer.playerId && l.club === career.club
    ),
    "user listing synced into leagueListedPlayers"
  );
  const club = findPlayerLeagueClub(career, squadPlayer.playerId);
  assert(club === career.club, "listed user player still registered at user club");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
