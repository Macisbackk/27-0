/**
 * Break-tests: salary cap renewals, elite limits, AI market/offers, loan inbox.
 */
import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import {
  calculateSalaryCapUsage,
  renewPlayerContract,
  signFreeAgent,
  wouldExceedEliteSquadLimit,
  countEliteFirstTeamPlayers,
} from "../src/lib/manager/contracts";
import { SALARY_CAP, ELITE_SQUAD_LIMITS, calculateMarketWage, calculateTransferFeeBetweenClubs } from "../src/lib/manager/rules";
import { processAiDecisionsForWeek } from "../src/lib/manager/ai";
import { createLoanAgreement } from "../src/lib/manager/loans";
import { submitTransferBid } from "../src/lib/manager/transfers";
import type { ManagerState } from "../src/lib/manager/types";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    passed++;
    console.log("OK:", msg);
  }
}

function renewAllFirstTeam(state: ManagerState, clubId: string): {
  state: ManagerState;
  ok: number;
  fail: number;
} {
  let next = state;
  let ok = 0;
  let fail = 0;
  const players = Object.values(next.players).filter(
    (p) => p.clubId === clubId && p.squadTier === "first" && p.contract && !p.loan
  );
  for (const p of players) {
    const market = calculateMarketWage(
      p.rating,
      p.age,
      next.clubs[clubId].competitionId
    );
    const offered = Math.max(p.contract!.wageWeekly, market);
    const res = renewPlayerContract(next, p.id, offered, 2, p.contract!.role || "first_team", {
      silent: true,
    });
    if (res.success) {
      next = res.state;
      ok++;
    } else {
      fail++;
      if (fail <= 3) console.log("  renew fail", p.name, p.rating, res.error);
    }
  }
  return { state: next, ok, fail };
}

console.log("\n=== Cap sizes ===");
assert(SALARY_CAP["super-league"].weeklyCap > 55_000, "SL weekly cap raised past old ~40k");
assert(SALARY_CAP["championship"].weeklyCap > 28_000, "Champ weekly cap raised");
assert(SALARY_CAP["super-league"].maxMarqueePlayers >= 3, "SL has 3+ marquees");
assert(ELITE_SQUAD_LIMITS["super-league"].maxFirstTeam === 8, "SL elite soft limit is 8");

console.log("\n=== Full first-team renewals (Championship start) ===");
let state = initializeManagerDatabase("widnes-vikings", "Cap Test");
const before = calculateSalaryCapUsage(state, "widnes-vikings");
assert(before.capLimitWeekly === SALARY_CAP["championship"].weeklyCap, "usage uses new Champ cap");
const renewChamp = renewAllFirstTeam(state, "widnes-vikings");
state = renewChamp.state;
assert(
  renewChamp.fail === 0,
  `Championship first team all renew (${renewChamp.ok} ok / ${renewChamp.fail} fail)`
);

console.log("\n=== Full first-team renewals (Super League) ===");
let sl = initializeManagerDatabase("wigan-warriors", "SL Cap");
const renewSl = renewAllFirstTeam(sl, "wigan-warriors");
sl = renewSl.state;
assert(
  renewSl.fail === 0,
  `Wigan first team all renew (${renewSl.ok} ok / ${renewSl.fail} fail)`
);

console.log("\n=== Elite hoarding brake ===");
const elites = countEliteFirstTeamPlayers(sl, "wigan-warriors");
assert(elites.limit === 8, "Wigan elite limit 8");
// Force enough elites if squad is short, then try signing another
let eliteState = sl;
const freeAgents = Object.values(eliteState.players).filter((p) => p.clubId === null);
// Promote ratings on first team to fill elite slots artificially
const firstIds = Object.values(eliteState.players)
  .filter((p) => p.clubId === "wigan-warriors" && p.squadTier === "first" && !p.loan)
  .slice(0, 8)
  .map((p) => p.id);
const playersPatch = { ...eliteState.players };
for (const id of firstIds) {
  playersPatch[id] = { ...playersPatch[id], rating: 88 };
}
eliteState = { ...eliteState, players: playersPatch };
const block = wouldExceedEliteSquadLimit(eliteState, "wigan-warriors", 88);
assert(!!block, "Elite limit blocks another 88+ signing when already at 8");

if (freeAgents[0]) {
  const sign = signFreeAgent(
    eliteState,
    "wigan-warriors",
    freeAgents[0].id,
    calculateMarketWage(90, 25, "super-league"),
    2,
    "star"
  );
  // May fail on cap OR elite — either is fine for anti-hoard
  assert(!sign.success, "Cannot freely add another elite free agent onto a stacked squad");
}

console.log("\n=== AI market + inbox offers ===");
let aiState = initializeManagerDatabase("bradford-bulls", "AI Market");
// List a mid player so AI can find targets easily + advance into window weeks
const listable = Object.values(aiState.players).find(
  (p) =>
    p.clubId === "bradford-bulls" &&
    p.squadTier === "first" &&
    p.rating >= 74 &&
    p.rating <= 82
);
assert(!!listable, "Found listable Bradford first-teamer");
if (listable) {
  aiState = {
    ...aiState,
    players: {
      ...aiState.players,
      [listable.id]: { ...listable, isTransferListed: true },
    },
  };
}

let sawTransferMail = false;
let sawLoanMail = false;
let sawTransferBid = false;
let sawLoanOffer = false;
for (let w = 0; w < 12; w++) {
  try {
    aiState = advanceWeek(aiState);
  } catch (e) {
    console.log("advance stop", e);
    break;
  }
  const mail = aiState.inbox.messages;
  if (mail.some((m) => m.category === "transfer" && m.actionRequired)) sawTransferMail = true;
  if (mail.some((m) => m.category === "loan" && m.actionRequired)) sawLoanMail = true;
  if (
    aiState.transfers.activeBids.some(
      (b) => b.toClubId === "bradford-bulls" && b.status === "pending_club"
    )
  ) {
    sawTransferBid = true;
  }
  if ((aiState.transfers.pendingLoanOffers || []).length > 0) sawLoanOffer = true;
}
assert(
  sawTransferBid,
  "User receives pending transfer bid (popup queue source)"
);
assert(!sawTransferMail, "Transfer bids do not clog inbox with action mail");
assert(sawLoanOffer, "User receives pending loan offer for popup");
assert(!sawLoanMail, "Loan offers do not clog inbox with action mail");

console.log("\n=== Loan offer accept path ===");
let loanState = initializeManagerDatabase("york-knights", "Loan Path");
const parent = Object.values(loanState.clubs).find(
  (c) => c.competitionId === "super-league" && c.id !== "york-knights"
)!;
const kid = Object.values(loanState.players).find(
  (p) =>
    p.clubId === parent.id &&
    (p.squadTier === "reserves" || p.squadTier === "academy") &&
    !p.loan &&
    p.age <= 23
);
assert(!!kid, "Found SL reserve/academy loan candidate");
if (kid) {
  const loan = createLoanAgreement(loanState, parent.id, "york-knights", kid.id, 8, 50, true);
  assert(loan.success, `Loan into York succeeds (${loan.error || "ok"})`);
  if (loan.success) {
    assert(loan.state.players[kid.id].loan?.destinationClubId === "york-knights", "Player loan dest is York");
  }
}

console.log("\n=== AI↔AI bid resolution ===");
let deal = initializeManagerDatabase("leeds-rhinos", "AI Deal");
const sellerClubId = "castleford-tigers";
const buyerClubId = "wakefield-trinity";
const listed = Object.values(deal.players).find(
  (p) => p.clubId === sellerClubId && p.squadTier === "first" && p.rating >= 68
);
assert(!!listed, "Found Castleford player for AI↔AI bid");
if (listed) {
  deal = {
    ...deal,
    players: {
      ...deal.players,
      [listed.id]: { ...listed, isTransferListed: true },
    },
    calendar: { ...deal.calendar, currentWeek: 6 },
    clubs: {
      ...deal.clubs,
      [buyerClubId]: {
        ...deal.clubs[buyerClubId],
        finances: { ...deal.clubs[buyerClubId].finances, balance: 800_000 },
      },
    },
  };
  const fee = Math.max(
    25_000,
    Math.round(
      calculateTransferFeeBetweenClubs(
        listed.rating,
        listed.potential,
        listed.age,
        "super-league",
        "super-league"
      ) * 1.25
    )
  );
  const wage = calculateMarketWage(listed.rating, listed.age, "super-league");
  const bid = submitTransferBid(deal, buyerClubId, listed.id, fee, wage, "first_team", 2);
  assert(bid.success, `AI bid submitted (${bid.error || "ok"})`);
  if (bid.success && bid.bid) {
    deal = processAiDecisionsForWeek(bid.state);
    const recheck = deal.transfers.activeBids.find((b) => b.id === bid.bid!.id);
    if (recheck) {
      assert(
        recheck.status !== "pending_club",
        `AI↔AI bid resolved (status=${recheck.status})`
      );
    } else {
      assert(
        (deal.transfers.completedTransfers || []).some((t) => t.playerId === listed.id),
        "AI↔AI bid completed transfer"
      );
    }
  }
}

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
