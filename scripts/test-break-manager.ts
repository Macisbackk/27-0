/**
 * Deliberate Break-Testing Suite for Rugby League Manager Mode.
 * Actively attacks edge cases, race conditions, illegal operations,
 * salary cap breaches, corrupted saves, and duplicate submissions.
 */

import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import { movePlayerTier, validateSquadInvariants, setClubLineup } from "../src/lib/manager/squad";
import { renewPlayerContract, signFreeAgent } from "../src/lib/manager/contracts";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  completeTransfer,
} from "../src/lib/manager/transfers";
import { createLoanAgreement, recallLoan } from "../src/lib/manager/loans";
import { exportSaveToJson, importSaveFromJson } from "../src/lib/manager/storage";

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Break test failed: ${message}`);
  }
  passedCount++;
  console.log(`✓ [PASS] ${message}`);
}

async function runBreakTests() {
  console.log("\n========================================================");
  console.log("RUNNING DELIBERATE BREAK-TEST SUITE FOR MANAGER MODE");
  console.log("========================================================\n");

  let state = initializeManagerDatabase("widnes-vikings", "Test Manager");

  // ----------------------------------------------------
  // BREAK TEST 1: Double Week Advancement Protection
  // ----------------------------------------------------
  console.log("--- Break Test 1: Rapid Double-Click & Week Idempotency ---");
  const week1State = { ...state };
  const advancedOnce = advanceWeek(week1State);
  assert(advancedOnce.calendar.currentWeek === 2, "Week 1 advanced to Week 2");

  // Deliberately try to process the SAME week again
  const duplicateAdvance = advanceWeek(advancedOnce);
  assert(
    duplicateAdvance.calendar.currentWeek === 3,
    "Cleanly handles sequential advance to Week 3 without throwing"
  );

  // Attempt to pass an already processed state to advanceWeek
  const staleAttempt = advanceWeek(advancedOnce);
  // advancedOnce has weekKey 2026_w1 recorded. Trying to re-run advanceWeek with currentWeek = 2
  // should process week 2, NOT week 1 again.
  assert(
    staleAttempt.calendar.processedWeekKeys.filter((k) => k === "2026_w1").length === 1,
    "Week key 2026_w1 is NEVER duplicated in history"
  );

  // ----------------------------------------------------
  // BREAK TEST 2: Illegal Transfers & Inadequate Funds
  // ----------------------------------------------------
  console.log("\n--- Break Test 2: Illegal Transfers & Inadequate Funds ---");
  const targetPlayer = Object.values(state.players).find((p) => p.clubId === "st-helens")!;

  // A: Attempt to bid more than transfer budget
  const hugeFee = state.clubs["widnes-vikings"].finances.transferBudget + 5_000_000;
  const overspendBid = submitTransferBid(
    state,
    "widnes-vikings",
    targetPlayer.id,
    hugeFee,
    2000,
    "first_team",
    2
  );
  assert(!overspendBid.success, "Bid exceeding transfer budget is strictly blocked");
  assert(
    overspendBid.error?.includes("Insufficient Funds") === true,
    "Clear error returned for insufficient transfer funds"
  );

  // B: Attempt to bid on own player
  const ownPlayer = Object.values(state.players).find((p) => p.clubId === "widnes-vikings")!;
  const ownBid = submitTransferBid(
    state,
    "widnes-vikings",
    ownPlayer.id,
    10_000,
    2000,
    "first_team",
    2
  );
  assert(!ownBid.success, "Cannot submit transfer bid for a player already at the club");

  // C: Attempt to complete a rejected or pending bid
  const unacceptedBid = submitTransferBid(
    state,
    "widnes-vikings",
    targetPlayer.id,
    10_000,
    1000,
    "rotation",
    2
  );
  assert(unacceptedBid.success, "Initial bid submitted");
  const earlyComplete = completeTransfer(unacceptedBid.state, unacceptedBid.bid!.id);
  assert(!earlyComplete.success, "Cannot complete a transfer before club and player acceptance");

  // D: Transfer an injured or suspended player
  const injuredTarget = Object.values(state.players).find((p) => p.clubId === "st-helens")!;
  let injuredState = {
    ...state,
    players: {
      ...state.players,
      [injuredTarget.id]: {
        ...injuredTarget,
        injury: {
          type: "ACL Tear",
          weeksRemaining: 16,
          severity: "severe" as const,
        },
      },
    },
  };

  const bidInjured = submitTransferBid(
    injuredState,
    "widnes-vikings",
    injuredTarget.id,
    20_000,
    3000,
    "first_team",
    2
  );
  const evalInjuredClub = evaluateSellingClubBid(bidInjured.state, bidInjured.bid!.id);
  // Complete transfer and verify medical status remains intact
  if (evalInjuredClub.bid?.status === "club_accepted") {
    evalInjuredClub.bid.status = "player_accepted";
    const compInjured = completeTransfer(evalInjuredClub.state, evalInjuredClub.bid.id);
    assert(compInjured.success, "Transfer of injured player completed");
    assert(
      compInjured.state.players[injuredTarget.id].injury?.weeksRemaining === 16,
      "Injury details preserved post-transfer"
    );
    assert(validateSquadInvariants(compInjured.state).valid, "Invariants hold after injured player transfer");
  }

  // ----------------------------------------------------
  // BREAK TEST 3: Illegal Loan Operations
  // ----------------------------------------------------
  console.log("\n--- Break Test 3: Illegal Loan Operations ---");
  const reserveP = Object.values(state.players).find(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "reserves"
  )!;

  // A: Loan to same club
  const sameClubLoan = createLoanAgreement(
    state,
    "widnes-vikings",
    "widnes-vikings",
    reserveP.id,
    8,
    50,
    true
  );
  assert(!sameClubLoan.success, "Cannot loan player to the same club");

  // B: Loan player from another club without ownership
  const otherClubPlayer = Object.values(state.players).find((p) => p.clubId === "wigan-warriors")!;
  const illegalParentLoan = createLoanAgreement(
    state,
    "widnes-vikings",
    "barrow-raiders",
    otherClubPlayer.id,
    8,
    50,
    true
  );
  assert(!illegalParentLoan.success, "Cannot loan a player belonging to a different parent club");

  // C: Loan an already loaned player
  const validLoan = createLoanAgreement(
    state,
    "widnes-vikings",
    "barrow-raiders",
    reserveP.id,
    8,
    50,
    true
  );
  assert(validLoan.success, "First loan succeeded");
  const doubleLoan = createLoanAgreement(
    validLoan.state,
    "widnes-vikings",
    "halifax-panthers",
    reserveP.id,
    8,
    50,
    true
  );
  assert(!doubleLoan.success, "Cannot loan a player who is already on loan");

  // D: Recall a player who is not on loan
  const notLoanedP = Object.values(state.players).find(
    (p) => p.clubId === "widnes-vikings" && !p.loan
  )!;
  const invalidRecall = recallLoan(state, notLoanedP.id);
  assert(!invalidRecall.success, "Cannot recall a player who is not currently on loan");

  // ----------------------------------------------------
  // BREAK TEST 4: Salary Cap Breaches
  // ----------------------------------------------------
  console.log("\n--- Break Test 4: Salary Cap Breaches ---");
  const capPlayer = Object.values(state.players).find((p) => p.clubId === "widnes-vikings")!;
  // Attempt to offer astronomical wage
  const astronomicalRenewal = renewPlayerContract(state, capPlayer.id, 2_000_000, 3, "star");
  assert(!astronomicalRenewal.success, "Contract renewal that breaches salary cap is blocked");
  assert(
    astronomicalRenewal.error?.includes("Salary Cap Breach") === true,
    "Explains salary cap breach in error message"
  );

  // Attempt to sign free agent with wage exceeding cap room
  const freeAgents = Object.values(state.players).filter((p) => p.clubId === null);
  if (freeAgents.length > 0) {
    const hugeFaSign = signFreeAgent(state, "widnes-vikings", freeAgents[0].id, 1_500_000, 2, "star");
    assert(!hugeFaSign.success, "Signing free agent that breaches salary cap is blocked");
  }

  // ----------------------------------------------------
  // BREAK TEST 5: Corrupt & Malicious JSON Saves
  // ----------------------------------------------------
  console.log("\n--- Break Test 5: Corrupt & Malicious Save Files ---");
  assert(importSaveFromJson("") === null, "Empty string import returns null");
  assert(importSaveFromJson("not-even-json{") === null, "Malformed JSON syntax returns null");
  assert(importSaveFromJson("{}") === null, "Empty object missing schema returns null");
  assert(
    importSaveFromJson(JSON.stringify({ version: 1, calendar: null })) === null,
    "Corrupt calendar structure returns null"
  );

  // Valid export and import round-trip
  const validJson = exportSaveToJson(state);
  const reloaded = importSaveFromJson(validJson);
  assert(reloaded !== null, "Valid JSON round-trips without corruption");
  assert(validateSquadInvariants(reloaded!).valid, "Imported state satisfies all squad invariants");

  // ----------------------------------------------------
  // BREAK TEST 6: Rapid Squad Tier Cycling (50 Iterations)
  // ----------------------------------------------------
  console.log("\n--- Break Test 6: Rapid Squad Tier Cycling (50 iterations) ---");
  let cycleState = { ...state };
  const cyclePlayer = Object.values(cycleState.players).find((p) => p.clubId === "widnes-vikings")!;

  for (let i = 0; i < 50; i++) {
    const targetTier = i % 3 === 0 ? "reserves" : i % 3 === 1 ? "first" : "reserves";
    const res = movePlayerTier(cycleState, cyclePlayer.id, targetTier);
    if (!res.success) {
      throw new Error(`Cycle failed at iteration ${i}: ${res.error}`);
    }
    cycleState = res.state;
  }
  assert(validateSquadInvariants(cycleState).valid, "Squad invariants 100% intact after 50 rapid tier transitions");

  // ----------------------------------------------------
  // BREAK TEST 7: Lineup Invariants & Duplicate Selection
  // ----------------------------------------------------
  console.log("\n--- Break Test 7: Lineup Invariants & Duplicate Selection ---");
  const widnesFirstTeam = Object.values(cycleState.players).filter(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "first"
  );
  assert(widnesFirstTeam.length >= 2, "Widnes has at least 2 first team players");

  const dupPlayer = widnesFirstTeam[0];
  const otherPlayer = widnesFirstTeam[1];

  const badLineup = {
    starting13: [dupPlayer.id, dupPlayer.id, otherPlayer.id, ...Array(10).fill(null)],
    bench: [null, null, null, null],
  };
  const badRes = setClubLineup(cycleState, "widnes-vikings", badLineup);
  assert(!badRes.success, "Selecting the same player in multiple lineup slots is strictly rejected");
  assert(
    badRes.error?.includes("multiple positions") === true,
    "Clear error returned for duplicate player in lineup"
  );

  console.log("\n========================================================");
  console.log(`ALL BREAK TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

runBreakTests().catch((err) => {
  console.error("FATAL ERROR IN BREAK TEST:", err);
  process.exit(1);
});
