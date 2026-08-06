/**
 * Compare senior vs reserve transfer-offer frequencies across many seasons.
 * Run: npx tsx scripts/sim-senior-transfer-offers.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { ensureChampionshipSystems } from "../src/lib/manager/championship/ensureChampionship";
import {
  generateIncomingTransferOffers,
  generateUnsolicitedTransferOffers,
  isSeniorSeasonApproachMessage,
} from "../src/lib/manager/managerTransferLeague";
import { maybeChampionshipBidForSlReserves } from "../src/lib/manager/championshipBidForSlReserves";
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "../src/lib/manager/transferActivityConfig";
import type { ManagerCareer } from "../src/lib/manager/types";

const SEASONS = 200;
const SEASON_WEEKS = 27;
const CLUB = "Leeds Rhinos";

function runWeek(career: ManagerCareer, week: number): ManagerCareer {
  let next: ManagerCareer = {
    ...career,
    gameWeek: week,
    lastTransferScanGameWeek: undefined,
    // Resolve prior approaches so the season budget can keep firing
    // (mirrors a manager clearing the inbox between weeks).
    inboxMessages: career.inboxMessages.map((m) =>
      !m.resolved && (m.unsolicited || m.reserveOffer)
        ? { ...m, resolved: true, read: true }
        : m
    ),
  };
  // Mirror advanceManagerMatchWeek: scan once per gameWeek, then reserve bids.
  if (next.gameWeek !== (next.lastTransferScanGameWeek ?? -1)) {
    next = generateIncomingTransferOffers(next);
    next = generateUnsolicitedTransferOffers(next);
    next = { ...next, lastTransferScanGameWeek: next.gameWeek };
  }
  next = maybeChampionshipBidForSlReserves(next);
  return next;
}

function seedEligibleReserves(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    reserves: (career.reserves ?? []).map((r, i) => ({
      ...r,
      rating: 72 + (i % 10),
      potentialRating: Math.min(90, 78 + (i % 8)),
      age: 19 + (i % 7),
      markedForRelease: false,
    })),
    reserveToChampionshipCooldowns: {},
  };
}

let seniorUnsolicited = 0;
let seniorListed = 0;
let reserveOffers = 0;
let earlySenior = 0;
let seasonsWithZeroSenior = 0;
const earlyThrough =
  DEFAULT_TRANSFER_ACTIVITY_CONFIG.transferTargetPool.earlySeasonThroughWeek;

for (let season = 0; season < SEASONS; season++) {
  let career = createNewCareer(CLUB);
  career = ensureChampionshipSystems(career);
  career = seedEligibleReserves({
    ...career,
    seed: `${career.seed}-sim-senior-${season}`,
    seasonYear: 2026 + (season % 8),
    inboxMessages: [],
  });

  const beforeIds = new Set(career.inboxMessages.map((m) => m.id));
  let seasonSenior = 0;

  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const prevIds = new Set(career.inboxMessages.map((m) => m.id));
    career = runWeek(career, week);
    const created = career.inboxMessages.filter((m) => !prevIds.has(m.id));

    for (const msg of created) {
      if (msg.reserveOffer || msg.offerCategory === "reserve") {
        reserveOffers++;
        continue;
      }
      if (isSeniorSeasonApproachMessage(msg)) {
        seniorUnsolicited++;
        seasonSenior++;
        if (week <= earlyThrough) earlySenior++;
      } else if (msg.offerCategory === "senior-listed" || msg.type === "transfer") {
        seniorListed++;
        seasonSenior++;
      }
    }
  }

  if (seasonSenior === 0) seasonsWithZeroSenior++;
  void beforeIds;
}

const seniorTotal = seniorUnsolicited + seniorListed;
console.log(`Senior vs reserve transfer offers — ${SEASONS} seasons × ${SEASON_WEEKS} weeks`);
console.log(`  senior unsolicited approaches: ${seniorUnsolicited} (avg ${(seniorUnsolicited / SEASONS).toFixed(2)}/season)`);
console.log(`  senior listed offers:          ${seniorListed} (avg ${(seniorListed / SEASONS).toFixed(2)}/season)`);
console.log(`  reserve / Championship offers: ${reserveOffers} (avg ${(reserveOffers / SEASONS).toFixed(2)}/season)`);
console.log(
  `  early-season share of unsolicited (weeks 1–${earlyThrough}): ${((earlySenior / Math.max(1, seniorUnsolicited)) * 100).toFixed(1)}%`
);
console.log(
  `  seasons with zero senior approaches: ${seasonsWithZeroSenior} (${((seasonsWithZeroSenior / SEASONS) * 100).toFixed(1)}%)`
);
console.log(
  `  senior:reserve ratio: ${seniorTotal}:${reserveOffers} (${(
    seniorTotal / Math.max(1, reserveOffers)
  ).toFixed(2)} senior per reserve)`
);
