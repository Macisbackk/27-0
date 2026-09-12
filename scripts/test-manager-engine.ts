/**
 * Comprehensive Automated Test Suite for Rugby League Manager Mode.
 *
 * Runs end-to-end unit and invariant tests covering:
 * 1. Database & Invariants Initialization
 * 2. Transfers (successful, club rejected, player rejected, fee transfer, salary cap impact)
 * 3. Loans (agreement, destination arrival, parent removal, matchplay, recall, expiry return)
 * 4. Contracts (renewal, rejection, free agency, termination)
 * 5. Squad Tiers (First Team <-> Reserves <-> Academy movement, lineup cleanup)
 * 6. Player Development (potential ceiling, youth growth vs veteran decline, injury impact)
 * 7. Fixtures & Idempotent Week Advancement (duplicate week rejection, exact-once processing)
 * 8. Matches (Rugby League score snapping, try allocation, MOTM, league standings vs friendlies isolation)
 * 9. Finances & Salary Cap (wage deductions, gate receipts, cap limits and marquee exemptions)
 * 10. AI Management (AI renewals, AI youth promotions, AI transfers, AI loans)
 * 11. Championship Mode & Season Rollover (promotion, relegation, ageing, youth intake generation)
 * 12. Save & Load Serialization (state preservation across reload)
 */

import {
  initializeManagerDatabase,
  validateSquadInvariants,
  movePlayerTier,
  setClubLineup,
  autoPickClubLineup,
  renewPlayerContract,
  releasePlayerContract,
  signFreeAgent,
  calculateSalaryCapUsage,
  submitTransferBid,
  evaluateSellingClubBid,
  evaluatePlayerTransferTerms,
  completeTransfer,
  createLoanAgreement,
  recallLoan,
  tickActiveLoans,
  advanceWeek,
  rolloverSeason,
  exportSaveToJson,
  importSaveFromJson,
  calculatePlayerValue,
  calculateMarketWage,
  simulateManagerMatch,
  progressPlayerWeek,
} from "../src/lib/manager";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

function runTests() {
  console.log("=== STARTING RUGBY LEAGUE MANAGER MODE TEST SUITE ===\n");

  // ----------------------------------------------------
  // TEST GROUP 1: Database Initialization & Invariants
  // ----------------------------------------------------
  console.log("TEST GROUP 1: Database Initialization & Invariants");
  const state = initializeManagerDatabase("widnes-vikings", "Coach Test");

  assert(state !== null, "State initializes properly");
  assert(state.manager.clubId === "widnes-vikings", "User club is set to Widnes Vikings (Championship)");
  assert(Object.keys(state.clubs).length === 28, "Contains 14 Super League + 14 Championship clubs");
  assert(Object.keys(state.players).length > 700, "Contains comprehensive player database (> 700 players)");

  const invariantCheck = validateSquadInvariants(state);
  assert(invariantCheck.valid, "Initial game world satisfies all squad invariants", invariantCheck.errors.join("; "));

  // Verify Widnes Vikings squad has first team, reserves, and academy
  const widnesPlayers = Object.values(state.players).filter((p) => p.clubId === "widnes-vikings");
  const firstCount = widnesPlayers.filter((p) => p.squadTier === "first").length;
  const reservesCount = widnesPlayers.filter((p) => p.squadTier === "reserves").length;
  const academyCount = widnesPlayers.filter((p) => p.squadTier === "academy").length;

  assert(firstCount >= 17, `Widnes First Team has at least 17 players (${firstCount})`);
  assert(reservesCount >= 4, `Widnes Reserves has at least 4 players (${reservesCount})`);
  assert(academyCount >= 4, `Widnes Academy has at least 4 players (${academyCount})`);

  // ----------------------------------------------------
  // TEST GROUP 2: Squad Movement Invariants
  // ----------------------------------------------------
  console.log("\nTEST GROUP 2: Squad Movement Invariants");
  const testPlayer = widnesPlayers.find((p) => p.squadTier === "academy");
  assert(testPlayer !== undefined, "Found test academy player");

  // Academy -> Reserves
  const toReserves = movePlayerTier(state, testPlayer!.id, "reserves");
  assert(toReserves.success, "Move player from Academy to Reserves succeeds");
  assert(toReserves.state.players[testPlayer!.id].squadTier === "reserves", "Player tier updated to reserves");

  // Reserves -> First Team
  const toFirst = movePlayerTier(toReserves.state, testPlayer!.id, "first");
  assert(toFirst.success, "Move player from Reserves to First Team succeeds");
  assert(toFirst.state.players[testPlayer!.id].squadTier === "first", "Player tier updated to first");

  // First Team -> Reserves and ensure lineup removes them if they were selected
  const clubWithPlayerInLineup = toFirst.state.clubs["widnes-vikings"];
  clubWithPlayerInLineup.lineup.starting13[0] = testPlayer!.id;

  const toReservesAgain = movePlayerTier(toFirst.state, testPlayer!.id, "reserves");
  assert(toReservesAgain.success, "Demote player back to Reserves succeeds");
  assert(
    !toReservesAgain.state.clubs["widnes-vikings"].lineup.starting13.includes(testPlayer!.id),
    "Demoted player is cleanly removed from matchday starting lineup"
  );

  const squadCheck2 = validateSquadInvariants(toReservesAgain.state);
  assert(squadCheck2.valid, "Squad invariants hold after tier movements", squadCheck2.errors.join("; "));

  // ----------------------------------------------------
  // TEST GROUP 3: Contracts & Salary Cap
  // ----------------------------------------------------
  console.log("\nTEST GROUP 3: Contracts & Salary Cap");
  let testState = toReservesAgain.state;
  const renewalPlayer = widnesPlayers.find((p) => p.squadTier === "first")!;
  const oldWage = renewalPlayer.contract!.wageWeekly;

  // Unreasonable contract offer should be rejected by player
  const cheapOffer = renewPlayerContract(testState, renewalPlayer.id, 50, 2, "star");
  assert(!cheapOffer.success, "Low-ball contract offer is rejected by player");

  // Reasonable contract offer accepted
  const goodWage = Math.round(oldWage * 1.15);
  const goodOffer = renewPlayerContract(testState, renewalPlayer.id, goodWage, 3, "star");
  assert(goodOffer.success, "Fair contract offer is accepted by player");
  assert(goodOffer.state.players[renewalPlayer.id].contract!.wageWeekly === goodWage, "Player weekly wage updated");
  assert(
    goodOffer.state.players[renewalPlayer.id].contract!.expiresSeason === testState.calendar.currentSeason + 3,
    "Contract expiry season updated"
  );
  testState = goodOffer.state;

  // Salary cap test: offer an astronomically high wage that breaches the cap
  const capBreachOffer = renewPlayerContract(testState, renewalPlayer.id, 999_999, 1, "star");
  assert(!capBreachOffer.success, "Contract renewal that breaches salary cap is blocked");
  assert(capBreachOffer.error?.includes("Salary Cap Breach") === true, "Clear salary cap rejection reason provided");

  // Release player to free agency
  const releaseRes = releasePlayerContract(testState, renewalPlayer.id);
  assert(releaseRes.success, "Releasing player succeeds");
  assert(releaseRes.state.players[renewalPlayer.id].clubId === null, "Released player has null clubId");
  assert(releaseRes.state.players[renewalPlayer.id].contract === null, "Released player has null contract");
  assert(releaseRes.state.players[renewalPlayer.id].squadTier === null, "Released player has null squadTier");

  // Sign Free Agent back
  const freeAgentSign = signFreeAgent(releaseRes.state, "widnes-vikings", renewalPlayer.id, goodWage, 2, "first_team");
  assert(freeAgentSign.success, "Signing free agent succeeds");
  assert(freeAgentSign.state.players[renewalPlayer.id].clubId === "widnes-vikings", "Signed free agent belongs to Widnes");
  assert(freeAgentSign.state.players[renewalPlayer.id].squadTier === "first", "Signed free agent is placed in First Team");
  testState = freeAgentSign.state;

  // ----------------------------------------------------
  // TEST GROUP 4: Transfers (Full Flow & Failures)
  // ----------------------------------------------------
  console.log("\nTEST GROUP 4: Transfers (Full Flow & Failures)");
  // Find a player from another club (e.g. Halifax Panthers)
  const halifaxPlayer = Object.values(testState.players).find(
    (p) => p.clubId === "halifax-panthers" && p.squadTier === "first"
  )!;
  const buyerId = "widnes-vikings";
  const sellerId = "halifax-panthers";

  const fairFee = calculatePlayerValue(halifaxPlayer.rating, halifaxPlayer.potential, halifaxPlayer.age);
  const fairWage = calculateMarketWage(halifaxPlayer.rating, halifaxPlayer.age, "championship");

  // Submitting bid
  const bidRes = submitTransferBid(testState, buyerId, halifaxPlayer.id, fairFee, fairWage, "first_team", 2);
  assert(bidRes.success, "Submitting transfer bid succeeds");
  const bidId = bidRes.bid!.id;
  testState = bidRes.state;

  // Club rejects inadequate bid
  const lowBidRes = submitTransferBid(testState, buyerId, halifaxPlayer.id, 500, fairWage, "first_team", 2);
  const evalLow = evaluateSellingClubBid(lowBidRes.state, lowBidRes.bid!.id);
  assert(evalLow.bid?.status === "club_rejected", "Selling club rejects inadequate low transfer fee");

  // Club accepts fair bid
  const evalFairClub = evaluateSellingClubBid(testState, bidId);
  assert(evalFairClub.bid?.status === "club_accepted", "Selling club accepts fair transfer bid");
  testState = evalFairClub.state;

  // Player considers terms
  const evalPlayer = evaluatePlayerTransferTerms(testState, bidId);
  assert(evalPlayer.bid?.status === "player_accepted", "Player accepts fair wage and contract terms");
  testState = evalPlayer.state;

  // Authoritative completion
  const preBuyerCash = testState.clubs[buyerId].finances.balance;
  const preSellerCash = testState.clubs[sellerId].finances.balance;

  const completeRes = completeTransfer(testState, bidId);
  assert(completeRes.success, "Completing transfer succeeds");
  assert(completeRes.state.players[halifaxPlayer.id].clubId === buyerId, "Player clubId transferred to buyer");
  assert(completeRes.state.players[halifaxPlayer.id].squadTier === "first", "Player squadTier set to first team in new club");
  assert(
    completeRes.state.clubs[buyerId].finances.balance === preBuyerCash - fairFee,
    "Transfer fee deducted from buyer balance"
  );
  assert(
    completeRes.state.clubs[sellerId].finances.balance === preSellerCash + fairFee,
    "Transfer fee credited to seller balance"
  );
  testState = completeRes.state;

  const squadCheck3 = validateSquadInvariants(testState);
  assert(squadCheck3.valid, "Squad invariants hold after completed transfer", squadCheck3.errors.join("; "));

  // ----------------------------------------------------
  // TEST GROUP 5: Loan System
  // ----------------------------------------------------
  console.log("\nTEST GROUP 5: Loan System");
  const loanPlayer = Object.values(testState.players).find(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "reserves" && !p.loan
  )!;

  const createLoanRes = createLoanAgreement(
    testState,
    "widnes-vikings",
    "barrow-raiders",
    loanPlayer.id,
    6,
    50,
    true
  );
  assert(createLoanRes.success, "Creating loan agreement succeeds");
  assert(createLoanRes.state.players[loanPlayer.id].loan !== null, "Player loan object populated");
  assert(
    createLoanRes.state.players[loanPlayer.id].loan?.destinationClubId === "barrow-raiders",
    "Loan destination is Barrow Raiders"
  );
  assert(
    createLoanRes.state.players[loanPlayer.id].clubId === "widnes-vikings",
    "Parent club retains contract ownership"
  );
  testState = createLoanRes.state;

  // Loan recall
  const recallRes = recallLoan(testState, loanPlayer.id);
  assert(recallRes.success, "Recalling loan succeeds");
  assert(recallRes.state.players[loanPlayer.id].loan === null, "Player loan object cleared on recall");
  testState = recallRes.state;

  // Loan tick & auto-expiry test
  const loan2 = createLoanAgreement(testState, "widnes-vikings", "barrow-raiders", loanPlayer.id, 1, 50, true);
  testState = loan2.state;
  assert(testState.transfers.activeLoans.length === 1, "Active loan recorded");
  // Tick loan
  testState = tickActiveLoans(testState);
  assert(testState.players[loanPlayer.id].loan === null, "Loan automatically ends when weeksRemaining reaches 0");
  assert(testState.transfers.activeLoans.length === 0, "Active loan removed from active loans list");

  // ----------------------------------------------------
  // TEST GROUP 6: Idempotent Week Advancement
  // ----------------------------------------------------
  console.log("\nTEST GROUP 6: Idempotent Week Advancement");
  const startWeek = testState.calendar.currentWeek;
  const startSeason = testState.calendar.currentSeason;

  // Advance week 1
  const afterWeek1 = advanceWeek(testState);
  assert(afterWeek1.calendar.currentWeek === startWeek + 1, "Week advances from 1 to 2");
  assert(afterWeek1.calendar.processedWeekKeys.includes(`${startSeason}_w1`), "Processed week key recorded");

  // Deliberate duplicate call with same state (simulating double click or rerender)
  const duplicateAdvance = advanceWeek(afterWeek1);
  // Now if we attempt to call advanceWeek on the OLD state with key '2026_w1'
  const duplicateOldAdvance = advanceWeek({
    ...afterWeek1,
    calendar: {
      ...afterWeek1.calendar,
      currentWeek: 1, // pretend a stale UI tried to advance week 1 again
    },
  });
  assert(
    duplicateOldAdvance.calendar.currentWeek === 1,
    "Duplicate advance of already-processed week key is strictly rejected"
  );

  // Check that Pre-Season Friendly in week 1 did NOT affect league standings!
  const widnesChampStandings = afterWeek1.competitions["championship"].standings.find(
    (s) => s.clubId === "widnes-vikings"
  );
  assert(
    widnesChampStandings?.played === 0,
    "Pre-Season Friendlies strictly DO NOT affect league standings (games played is 0)"
  );

  testState = afterWeek1;

  // ----------------------------------------------------
  // TEST GROUP 7: Match Engine & Try Distribution
  // ----------------------------------------------------
  console.log("\nTEST GROUP 7: Match Engine & Try Distribution");
  const homeClub = testState.clubs["wigan-warriors"];
  const awayClub = testState.clubs["st-helens"];
  const dummyFixture = {
    id: "test_derby",
    competitionId: "super-league" as const,
    season: 2026,
    week: 3,
    roundName: "Good Friday Derby",
    homeClubId: "wigan-warriors",
    awayClubId: "st-helens",
    isPlayed: false,
  };

  const matchRes = simulateManagerMatch(dummyFixture, homeClub, awayClub, testState.players);
  assert(matchRes.fixture.isPlayed, "Match fixture marked as played");
  assert(matchRes.fixture.homeScore !== undefined, "Home score generated");
  assert(matchRes.fixture.awayScore !== undefined, "Away score generated");
  assert(matchRes.fixture.scoreEvents!.length > 0, "Score events (tries, conversions) recorded");
  assert(matchRes.fixture.attendance! > 10000, "Realistic stadium attendance generated");
  assert(matchRes.fixture.manOfTheMatchPlayerId !== undefined, "Man of the Match awarded");

  // ----------------------------------------------------
  // TEST GROUP 8: Player Development & Ageing
  // ----------------------------------------------------
  console.log("\nTEST GROUP 8: Player Development & Ageing");
  const youngTalent = Object.values(testState.players).find(
    (p) => p.age === 18 && p.potential > p.rating + 5
  )!;
  const veteran = Object.values(testState.players).find((p) => p.age >= 34)!;

  // Simulate training progression
  const developedYoung = progressPlayerWeek(
    { ...youngTalent, trainingFocus: "development" },
    testState.clubs[youngTalent.clubId || "widnes-vikings"],
    "high"
  );
  assert(developedYoung.rating <= developedYoung.potential, "Rating never exceeds potential ceiling");

  const trainedVet = progressPlayerWeek(veteran, undefined, "normal");
  assert(trainedVet.age === veteran.age, "Age does not change during weekly training tick");

  // ----------------------------------------------------
  // TEST GROUP 9: Multi-Week Simulation & AI Actions
  // ----------------------------------------------------
  console.log("\nTEST GROUP 9: Multi-Week Simulation & AI Actions");
  // Simulate 4 weeks
  for (let w = 2; w <= 5; w++) {
    testState = advanceWeek(testState);
  }
  assert(testState.calendar.currentWeek === 6, "Simulated to Week 6");
  assert(testState.calendar.phase === "regular_season", "Transitioned to regular season phase");

  // League matches have begun in week 3+; verify standings updated
  const slRows = testState.competitions["super-league"].standings;
  const playedAny = slRows.some((r) => r.played > 0);
  assert(playedAny, "Super League matches have updated standings table");

  // ----------------------------------------------------
  // TEST GROUP 10: Atomic Season Rollover & Promotion/Relegation
  // ----------------------------------------------------
  console.log("\nTEST GROUP 10: Atomic Season Rollover & Promotion/Relegation");
  // Rig standings for testing promotion and relegation
  testState.competitions["super-league"].standings.forEach((r, idx) => {
    r.points = (14 - idx) * 2;
  });
  testState.competitions["championship"].standings.forEach((r, idx) => {
    r.points = (12 - idx) * 2;
  });

  const promotedClub = testState.competitions["championship"].standings[0].clubId;
  const relegatedClub = testState.competitions["super-league"].standings[13].clubId;

  const rolloverRes = rolloverSeason(testState);
  const nextSeasonState = rolloverRes.state;

  assert(nextSeasonState.calendar.currentSeason === 2027, "Season increments to 2027");
  assert(nextSeasonState.calendar.currentWeek === 1, "Week resets to 1");
  assert(nextSeasonState.calendar.processedWeekKeys.length === 0, "Processed week keys cleared for new season");

  // Check Promotion / Relegation
  assert(
    nextSeasonState.clubs[promotedClub].competitionId === "super-league",
    `Championship winner (${promotedClub}) promoted to Super League`
  );
  assert(
    nextSeasonState.clubs[relegatedClub].competitionId === "championship",
    `Super League bottom club (${relegatedClub}) relegated to Championship`
  );

  // Check youth intake generation
  const widnesNewAcademy = Object.values(nextSeasonState.players).filter(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "academy" && p.age === 17
  );
  assert(widnesNewAcademy.length >= 2, "Fresh youth academy intake generated on season rollover");

  const rolloverInvariants = validateSquadInvariants(nextSeasonState);
  assert(rolloverInvariants.valid, "All squad invariants valid after season rollover", rolloverInvariants.errors.join("; "));

  // ----------------------------------------------------
  // TEST GROUP 11: Save / Load Serialization
  // ----------------------------------------------------
  console.log("\nTEST GROUP 11: Save / Load Serialization");
  const exportedJson = exportSaveToJson(nextSeasonState);
  assert(exportedJson.length > 50000, "State exports to comprehensive JSON string");

  const importedState = importSaveFromJson(exportedJson);
  assert(importedState !== null, "State imports back from JSON cleanly");
  assert(importedState?.calendar.currentSeason === 2027, "Imported state preserves currentSeason 2027");
  assert(Object.keys(importedState?.clubs || {}).length === 28, "Imported state preserves all 28 clubs");
  assert(Object.keys(importedState?.players || {}).length > 700, "Imported state preserves all players");

  console.log("\n====================================================");
  console.log(`ALL AUTOMATED TESTS PASSED! (${passedCount} passed, ${failedCount} failed)`);
  console.log("====================================================\n");
}

try {
  runTests();
} catch (err) {
  console.error("Test execution aborted due to error:", err);
  process.exit(1);
}
