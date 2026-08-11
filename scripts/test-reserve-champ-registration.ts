/**
 * Reserve → Championship registration sync test.
 * Run: npx tsx scripts/test-reserve-champ-registration.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import {
  acceptReserveTransferOffer,
  maybeChampionshipBidForSlReserves,
} from "../src/lib/manager/championshipBidForSlReserves";
import { findPlayerLeagueClub } from "../src/lib/manager/managerLeagueRosters";
import { getPlayerRegistration } from "../src/lib/manager/playerRegistration";
import { assertSingleTransferState } from "../src/lib/manager/transferInvariants";
import { getChampionshipClubByName } from "../src/lib/clubs/championship-clubs";
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

console.log("Reserve → Championship registration\n");

let career: ManagerCareer = createNewCareer("Bradford Bulls");
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

let accepted = false;
for (let week = 1; week <= 40 && !accepted; week++) {
  career = { ...career, gameWeek: week };
  career = maybeChampionshipBidForSlReserves(career);
  const offer = career.inboxMessages.find(
    (m) => m.reserveOffer && !m.resolved && m.playerId
  );
  if (!offer?.playerId || !offer.offerClub) continue;

  const playerId = offer.playerId;
  const result = acceptReserveTransferOffer(career, offer.id);
  assert(result.ok, "accept reserve offer succeeds");
  if (!result.ok || !result.career) break;
  career = result.career;
  accepted = true;

  assert(
    !career.reserves.some((r) => r.id === playerId),
    "player removed from user reserves"
  );
  assert(
    findPlayerLeagueClub(career, playerId) === offer.offerClub,
    "findPlayerLeagueClub sees Championship club"
  );
  const champ = getChampionshipClubByName(offer.offerClub);
  assert(Boolean(champ), "championship club resolves");
  if (champ && career.championshipSquads) {
    assert(
      (career.championshipSquads.rosterByClub[champ.id] ?? []).includes(playerId),
      "player on championshipSquads roster"
    );
  }
  assert(
    (career.leagueClubRosters?.[offer.offerClub] ?? []).includes(playerId),
    "player mirrored on leagueClubRosters"
  );
  const reg = getPlayerRegistration(career, playerId);
  assert(
    reg.playingClubId === offer.offerClub && reg.squadStatus !== "RESERVES",
    "registration no longer user reserve"
  );
  const inv = assertSingleTransferState(career, playerId);
  assert(inv.valid, `invariant after reserve sale (${inv.violations.join("; ")})`);
  assert(
    (career.leagueTransfers ?? []).some((t) => t.playerId === playerId),
    "reserve move in leagueTransfers"
  );
}

assert(accepted, "at least one reserve offer accepted in 40 weeks");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
