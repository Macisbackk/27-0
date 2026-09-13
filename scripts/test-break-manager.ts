/**
 * Deliberate Break-Testing Suite for Rugby League Manager Mode.
 * Actively attacks edge cases, race conditions, illegal operations,
 * salary cap breaches, corrupted saves, and duplicate submissions.
 */

import { initializeManagerDatabase, ensureClubSquadDepth } from "../src/lib/manager/database";
import { advanceWeek, canAdvanceWeek, userClubHasMatchThisWeek } from "../src/lib/manager/advancement";
import {
  movePlayerTier,
  validateSquadInvariants,
  setClubLineup,
  getMatchdayLineupReadiness,
  canClubPlayMatchday,
  safeguardClubMatchdayLineup,
  isPlayerAvailableForClub,
  autoPickClubLineup,
  cleanAllClubLineups,
} from "../src/lib/manager/squad";
import { renewPlayerContract, signFreeAgent } from "../src/lib/manager/contracts";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  completeTransfer,
} from "../src/lib/manager/transfers";
import {
  createLoanAgreement,
  recallLoan,
  loanPlayerIn,
  terminateIncomingLoan,
  isPlayerEligibleForLoanIn,
} from "../src/lib/manager/loans";
import {
  exportSaveToJson,
  importSaveFromJson,
  saveManagerStateSync as saveManagerState,
  loadManagerStateSync as loadManagerState,
  getSaveSlotMetadata,
  getAllAvailableSaves,
  getMostRecentSave,
  deleteSaveSlotSync as deleteSaveSlot,
} from "../src/lib/manager/storage";
import { simulateManagerMatch, ensureFixtureKeyMoments } from "../src/lib/manager/match";
import { FIRST_NAMES, LAST_NAMES, generateRandomPlayerName } from "../src/lib/manager/names";
import {
  rolloverSeason,
  calculateSeasonAwards,
  buildRflSeasonReviewEmail,
  formatRflSeasonReviewFromBodyRecord,
} from "../src/lib/manager/rollover";
import {
  upgradeClubFacility,
  upgradeCoachingStaff,
  expandStadium,
  investInPlayer,
  canPlayerReceiveInvestment,
  getFacilityUpgradeCost,
  getCoachingUpgradeCost,
  getStadiumExpansionCost,
  getPlayerInvestmentCost,
} from "../src/lib/manager/facilities";
import {
  refreshClubBoardObjectives,
  isRegularSeasonSettled,
  countAcademyGraduateFirstTeamApps,
} from "../src/lib/manager/objectives";

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

  // E: Cannot loan Championship player to a Super League club (unrealistic destination)
  const champToSlLoan = createLoanAgreement(
    state,
    "widnes-vikings",
    "wigan-warriors",
    reserveP.id,
    8,
    50,
    true
  );
  assert(!champToSlLoan.success, "Championship clubs cannot loan players to Super League clubs");
  assert(
    champToSlLoan.error?.includes("Championship clubs cannot loan players to Super League clubs") === true,
    "Explains Championship to Super League loan restriction"
  );

  // F: Super League club cannot loan in from a Championship club
  const slLoanInFromChamp = loanPlayerIn(
    state,
    "wigan-warriors",
    reserveP.id,
    8,
    50,
    true
  );
  assert(!slLoanInFromChamp.success, "Super League clubs cannot loan in from Championship clubs");

  // G: Cannot loan in key 80+ starter unless loan listed
  const wiganStar = Object.values(state.players).find(
    (p) => p.clubId === "wigan-warriors" && p.squadTier === "first" && p.rating >= 80 && !p.isLoanListed
  );
  if (wiganStar) {
    const starLoanIn = loanPlayerIn(
      state,
      "widnes-vikings",
      wiganStar.id,
      8,
      50,
      true
    );
    assert(!starLoanIn.success, "Cannot loan in indispensable 80+ first team regulars");
  }

  // H: Successfully loan in an eligible prospect from a Super League club
  const loanInTarget = Object.values(state.players).find(
    (p) =>
      p.clubId === "wigan-warriors" &&
      p.loan === null &&
      !p.injury &&
      !p.suspension &&
      isPlayerEligibleForLoanIn(p, state.clubs["wigan-warriors"], state.clubs["widnes-vikings"]).eligible
  );
  assert(loanInTarget !== undefined, "Found an eligible loan in prospect from Super League");

  const successfulLoanIn = loanPlayerIn(
    state,
    "widnes-vikings",
    loanInTarget!.id,
    8,
    50,
    true
  );
  assert(successfulLoanIn.success, `Successfully loaned in ${loanInTarget!.name} to Widnes`);
  assert(successfulLoanIn.state.players[loanInTarget!.id].loan?.destinationClubId === "widnes-vikings", "Player record reflects destination club");

  // I: Terminate incoming loan early
  const terminatedRes = terminateIncomingLoan(
    successfulLoanIn.state,
    loanInTarget!.id,
    "widnes-vikings"
  );
  assert(terminatedRes.success, `Successfully returned ${loanInTarget!.name} to parent club early`);
  assert(terminatedRes.state.players[loanInTarget!.id].loan === null, "Player loan status is reset to null upon return");

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

  // ----------------------------------------------------
  // BREAK TEST 7b: Matchday 17 Safeguard Gate
  // ----------------------------------------------------
  console.log("\n--- Break Test 7b: Matchday 17 Safeguard Gate ---");
  const shortClub = cycleState.clubs["widnes-vikings"];
  const shortState = {
    ...cycleState,
    clubs: {
      ...cycleState.clubs,
      "widnes-vikings": {
        ...shortClub,
        lineup: {
          starting13: [...shortClub.lineup.starting13.slice(0, 10), null, null, null],
          bench: [null, null, null, null],
        },
      },
    },
  };
  const shortReady = getMatchdayLineupReadiness(shortState, "widnes-vikings");
  assert(!shortReady.ready, "Incomplete lineup is not matchday-ready");
  assert(shortReady.selectedCount < 17, "Incomplete lineup has fewer than 17 named players");
  assert(
    canClubPlayMatchday(shortState, "widnes-vikings").allowed === false,
    "Club cannot play with short 17"
  );

  if (userClubHasMatchThisWeek(shortState)) {
    const gate = canAdvanceWeek(shortState);
    assert(!gate.allowed, "Week advance blocked when user has a match and incomplete 17");
    assert(
      typeof gate.error === "string" && gate.error.length > 0,
      "Advance gate returns a clear lineup error"
    );
  }

  const safeguarded = safeguardClubMatchdayLineup(shortState, "leeds-rhinos");
  const aiReady = getMatchdayLineupReadiness(safeguarded, "leeds-rhinos");
  assert(aiReady.ready, "AI club safeguard restores a full eligible 17");

  // ----------------------------------------------------
  // BREAK TEST 8: Missing Reserves and Academy Auto-Generation
  // ----------------------------------------------------
  console.log("\n--- Break Test 8: Missing Reserves and Academy Auto-Generation ---");
  // Deliberately strip all reserves and academy players from a club
  const strippedPlayers = { ...state.players };
  for (const [pid, player] of Object.entries(strippedPlayers)) {
    if (player.clubId === "widnes-vikings" && (player.squadTier === "reserves" || player.squadTier === "academy")) {
      delete strippedPlayers[pid];
    }
  }

  const strippedState = {
    ...state,
    players: strippedPlayers,
  };

  const strippedClubPlayers = Object.values(strippedState.players).filter((p) => p.clubId === "widnes-vikings");
  const strippedRes = strippedClubPlayers.filter((p) => p.squadTier === "reserves").length;
  const strippedAcad = strippedClubPlayers.filter((p) => p.squadTier === "academy").length;
  assert(strippedRes === 0, "Artificially emptied reserves tier");
  assert(strippedAcad === 0, "Artificially emptied academy tier");

  // Run depth restoration
  const repairedState = ensureClubSquadDepth(strippedState, "widnes-vikings");
  const repairedClubPlayers = Object.values(repairedState.players).filter((p) => p.clubId === "widnes-vikings");
  const repairedRes = repairedClubPlayers.filter((p) => p.squadTier === "reserves").length;
  const repairedAcad = repairedClubPlayers.filter((p) => p.squadTier === "academy").length;

  assert(repairedRes >= 17, `Reserves automatically generated if none (now ${repairedRes})`);
  assert(repairedAcad >= 17, `Academy automatically generated if none (now ${repairedAcad})`);
  assert(validateSquadInvariants(repairedState).valid, "Squad invariants 100% valid after generating missing tiers");

  // ----------------------------------------------------
  // BREAK TEST 9: No First-Teamers In Reserves or Academy
  // ----------------------------------------------------
  console.log("\n--- Break Test 9: No First-Teamers In Reserves or Academy ---");
  for (const testCid of ["wigan-warriors", "st-helens", "catalans-dragons", "warrington-wolves", "widnes-vikings"]) {
    const clubState = initializeManagerDatabase(testCid);
    const clubPlayers = Object.values(clubState.players).filter((p) => p.clubId === testCid);

    const badRes = clubPlayers.filter(
      (p) => p.squadTier === "reserves" && (p.contract?.role === "star" || p.contract?.role === "first_team")
    );
    const badAcadRole = clubPlayers.filter(
      (p) => p.squadTier === "academy" && (p.contract?.role === "star" || p.contract?.role === "first_team")
    );
    const badAcadAge = clubPlayers.filter(
      (p) => p.squadTier === "academy" && p.age > 21
    );

    assert(badRes.length === 0, `${testCid}: Zero players with first_team/star contract in reserves`);
    assert(badAcadRole.length === 0, `${testCid}: Zero players with first_team/star contract in academy`);
    assert(badAcadAge.length === 0, `${testCid}: Zero players over 21 years old in academy`);
  }

  // ----------------------------------------------------
  // BREAK TEST 10: Match Key Moments Engine & Popup Invariants
  // ----------------------------------------------------
  console.log("\n--- Break Test 10: Match Key Moments Engine & Popup Invariants ---");
  const homeClub = state.clubs["wigan-warriors"];
  const awayClub = state.clubs["st-helens"];
  const mockFixture = {
    id: "test_fix_101",
    competitionId: "super-league" as const,
    season: 2026,
    week: 1,
    roundName: "Super League Derby",
    homeClubId: "wigan-warriors",
    awayClubId: "st-helens",
    isPlayed: false,
  };

  const sim = simulateManagerMatch(mockFixture, homeClub, awayClub, state.players);
  const playedFixture = sim.fixture;

  assert(playedFixture.keyMoments !== undefined && playedFixture.keyMoments.length > 0, "Key moments generated during match simulation");
  const moments = playedFixture.keyMoments!;

  // 1. Chronological Ordering
  let isChronological = true;
  for (let i = 0; i < moments.length - 1; i++) {
    if (moments[i].minute > moments[i + 1].minute) {
      isChronological = false;
      break;
    }
  }
  assert(isChronological, "Key moments are strictly ordered chronologically by match minute");

  // 2. Contains Half-Time and Full-Time
  const hasHT = moments.some((m) => m.type === "HALF_TIME" && m.minute === 40);
  const hasFT = moments.some((m) => m.type === "FULL_TIME");
  assert(hasHT, "Contains half-time interval checkpoint at minute 40");
  assert(hasFT, "Contains full-time conclusion moment");

  // 3. Final running score matches fixture outcome
  const finalMoment = moments[moments.length - 1];
  assert(finalMoment.homeScoreAfter === playedFixture.homeScore, "Final moment home score matches fixture homeScore");
  assert(finalMoment.awayScoreAfter === playedFixture.awayScore, "Final moment away score matches fixture awayScore");

  // 4. Content sanity
  const allHaveValidContent = moments.every(
    (m) => m.title.length > 0 && m.description.length > 0 && m.clubName.length > 0
  );
  assert(allHaveValidContent, "All key moments possess non-empty titles, descriptions, and club identifiers");

  // 5. Synthesis fallback resilience for legacy fixtures
  const bareLegacyFixture = {
    id: "legacy_fix_99",
    competitionId: "super-league" as const,
    season: 2026,
    week: 1,
    roundName: "Historic Match",
    homeClubId: "wigan-warriors",
    awayClubId: "st-helens",
    isPlayed: true,
    homeScore: 18,
    awayScore: 12,
    scoreEvents: [
      { minute: 14, type: "TRY" as const, playerId: "p1", playerName: "Liam Marshall", clubId: "wigan-warriors" },
      { minute: 15, type: "CONVERSION" as const, playerId: "p2", playerName: "Harry Smith", clubId: "wigan-warriors" },
      { minute: 55, type: "TRY" as const, playerId: "p3", playerName: "Jack Welsby", clubId: "st-helens" },
    ],
  };

  const synthesized = ensureFixtureKeyMoments(bareLegacyFixture, state.clubs);
  assert(synthesized.length >= 4, "Synthesizes key moments for legacy fixtures missing keyMoments property");
  assert(synthesized.some((m) => m.type === "HALF_TIME"), "Synthesized moments include half-time break");
  assert(synthesized[synthesized.length - 1].type === "FULL_TIME", "Synthesized moments end with full-time hooter");
  assert(synthesized[synthesized.length - 1].homeScoreAfter === 18, "Synthesized final home score matches legacy fixture");
  assert(synthesized[synthesized.length - 1].awayScoreAfter === 12, "Synthesized final away score matches legacy fixture");

  // ----------------------------------------------------
  // BREAK TEST 11: Generated Player Name Variety & Cultural Authenticity
  // ----------------------------------------------------
  console.log("\n--- Break Test 11: Generated Player Name Variety & Cultural Authenticity ---");
  assert(FIRST_NAMES.length >= 250, `Substantial first name variety pool (has ${FIRST_NAMES.length} names)`);
  assert(LAST_NAMES.length >= 350, `Substantial last name variety pool (has ${LAST_NAMES.length} names)`);

  // Test 100 generated players for high uniqueness
  const sampleNames = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const { fullName } = generateRandomPlayerName("wigan-warriors");
    sampleNames.add(fullName);
  }
  assert(sampleNames.size >= 90, `100 randomly generated players yield extremely high uniqueness (${sampleNames.size}/100 distinct names)`);

  // Test French club naming distribution
  let frenchCount = 0;
  for (let i = 0; i < 50; i++) {
    const res = generateRandomPlayerName("catalans-dragons");
    if (res.nationality === "France") frenchCount++;
  }
  assert(frenchCount >= 20, `Catalans Dragons generates high proportion of authentic French players (${frenchCount}/50)`);

  // Test Welsh club naming distribution
  let welshCount = 0;
  for (let i = 0; i < 50; i++) {
    const res = generateRandomPlayerName("north-wales-crusaders");
    if (res.nationality === "Wales") welshCount++;
  }
  assert(welshCount >= 10, `North Wales Crusaders generates authentic Welsh heritage players (${welshCount}/50)`);

  // ----------------------------------------------------
  // BREAK TEST 12: Facilities Upgrades, Stadium Expansion & Player Career Buffs
  // ----------------------------------------------------
  console.log("\n--- Break Test 12: Facilities Upgrades, Stadium Expansion & Player Career Buffs ---");
  const testClubId = state.manager.clubId;
  
  // Fund club treasury for comprehensive infrastructure testing
  state = {
    ...state,
    clubs: {
      ...state.clubs,
      [testClubId]: {
        ...state.clubs[testClubId],
        finances: {
          ...state.clubs[testClubId].finances,
          balance: 1_000_000,
        },
      },
    },
  };

  const initialClub = state.clubs[testClubId];
  const initialBalance = initialClub.finances.balance;
  const initialTrainingLevel = initialClub.facilities.training;

  // 1. Upgrade Senior Training Ground
  const trainUpgradeCost = getFacilityUpgradeCost(initialTrainingLevel, initialClub.competitionId);
  assert(trainUpgradeCost !== null, "Valid facility upgrade cost computed");
  
  const facilityUpgradeRes = upgradeClubFacility(state, testClubId, "training");
  if (!facilityUpgradeRes.success) {
    console.error("Facility upgrade failed with:", facilityUpgradeRes.error);
  }
  assert(facilityUpgradeRes.success, "Facility upgrade succeeds with adequate treasury funds");
  state = facilityUpgradeRes.state;

  const upgradedClub = state.clubs[testClubId];
  assert(upgradedClub.facilities.training === initialTrainingLevel + 1, "Facility star rating incremented by 1");
  assert(
    upgradedClub.finances.balance === initialBalance - (trainUpgradeCost || 0),
    "Facility upgrade fee correctly deducted from club treasury"
  );
  assert(
    upgradedClub.finances.history[0].category === "facilities",
    "Facility upgrade transaction recorded in club ledger"
  );

  // 2. Prevent upgrade when funds insufficient
  const brokeState = {
    ...state,
    clubs: {
      ...state.clubs,
      [testClubId]: {
        ...state.clubs[testClubId],
        finances: {
          ...state.clubs[testClubId].finances,
          balance: 100, // Broke club!
        },
      },
    },
  };
  const brokeUpgradeRes = upgradeClubFacility(brokeState, testClubId, "medical");
  assert(!brokeUpgradeRes.success, "Facility upgrade blocked when treasury funds are insufficient");

  // 3. Upgrade Coaching Staff
  const coachingCost = getCoachingUpgradeCost(initialClub.coachingQuality, initialClub.competitionId);
  if (coachingCost && initialClub.coachingQuality < 5) {
    const preCoachBalance = state.clubs[testClubId].finances.balance;
    const coachUpgradeRes = upgradeCoachingStaff(state, testClubId);
    assert(coachUpgradeRes.success, "Coaching staff upgrade succeeds");
    state = coachUpgradeRes.state;
    assert(
      state.clubs[testClubId].finances.balance === preCoachBalance - coachingCost,
      "Coaching upgrade fee deducted from club balance"
    );
  }

  // 4. Stadium Expansion
  const initialCapacity = state.clubs[testClubId].facilities.stadiumCapacity;
  const expansionSeats = 1500;
  const expansionCost = getStadiumExpansionCost(expansionSeats, state.clubs[testClubId].competitionId);
  const preStadiumBalance = state.clubs[testClubId].finances.balance;

  const stadiumRes = expandStadium(state, testClubId, expansionSeats);
  assert(stadiumRes.success, "Stadium expansion succeeds");
  state = stadiumRes.state;
  assert(
    state.clubs[testClubId].facilities.stadiumCapacity === initialCapacity + expansionSeats,
    "Stadium capacity increased by expanded seat count"
  );
  assert(
    state.clubs[testClubId].finances.balance === preStadiumBalance - expansionCost,
    "Stadium expansion cost deducted from treasury"
  );
  assert(
    state.clubs[testClubId].finances.history[0].category === "facilities",
    "Stadium expansion transaction logged in ledger"
  );

  // 5. Player Career Buffs: Elite Masterclass
  const playerToInvest = Object.values(state.players).find(
    (p) => p.clubId === testClubId && p.squadTier === "first"
  )!;
  assert(playerToInvest != null, "Found eligible squad player for career development investment");

  const preRating = playerToInvest.rating;
  const prePotential = playerToInvest.potential;
  const preMasterclassBalance = state.clubs[testClubId].finances.balance;
  const masterclassCost = getPlayerInvestmentCost("elite_masterclass", state.clubs[testClubId].competitionId);

  const masterclassRes = investInPlayer(state, testClubId, playerToInvest.id, "elite_masterclass");
  assert(masterclassRes.success, "Elite masterclass career investment succeeds");
  state = masterclassRes.state;

  const boostedPlayer = state.players[playerToInvest.id];
  assert(boostedPlayer.rating === preRating + 1, "Elite masterclass grants +1 immediate overall rating");
  assert(boostedPlayer.potential === prePotential + 2, "Elite masterclass permanently increases potential ceiling by +2");
  assert(
    boostedPlayer.careerBuffs?.some((b) => b.type === "elite_masterclass"),
    "Elite masterclass career buff registered on player record"
  );
  assert(
    state.clubs[testClubId].finances.balance === preMasterclassBalance - masterclassCost,
    "Player investment cost deducted from treasury"
  );

  // 6. Prevent Duplicate Masterclass on Same Player
  const duplicateMasterclass = investInPlayer(state, testClubId, playerToInvest.id, "elite_masterclass");
  assert(!duplicateMasterclass.success, "Re-applying elite masterclass blocked: player already completed it");

  // 7. Accelerated Rehab on Injured Player
  // Setup player with 4-week injury
  state = {
    ...state,
    players: {
      ...state.players,
      [playerToInvest.id]: {
        ...state.players[playerToInvest.id],
        injury: {
          type: "Hamstring Strain",
          severity: "moderate",
          weeksRemaining: 4,
        },
      },
    },
  };

  const rehabRes = investInPlayer(state, testClubId, playerToInvest.id, "accelerated_rehab");
  assert(rehabRes.success, "Specialist accelerated rehab succeeds for injured player");
  state = rehabRes.state;
  const rehabPlayer = state.players[playerToInvest.id];
  assert(
    rehabPlayer.injury !== null && rehabPlayer.injury.weeksRemaining <= 2,
    `Accelerated rehab shaves 2-3 weeks off recovery (now ${rehabPlayer.injury?.weeksRemaining}w remaining)`
  );

  // If injury is 2 weeks or less, accelerated rehab returns them immediately
  const finalRehabRes = investInPlayer(state, testClubId, playerToInvest.id, "accelerated_rehab");
  assert(finalRehabRes.success, "Second rehab clears remaining injury");
  state = finalRehabRes.state;
  assert(state.players[playerToInvest.id].injury === null, "Player fully cleared from injury list");

  // 8. Prevent Accelerated Rehab on Healthy Player
  const healthyRehabRes = investInPlayer(state, testClubId, playerToInvest.id, "accelerated_rehab");
  assert(!healthyRehabRes.success, "Accelerated rehab blocked for non-injured player");

  // 9. Biomechanics & Physical Transformation
  // Setup high fatigue
  state = {
    ...state,
    players: {
      ...state.players,
      [playerToInvest.id]: {
        ...state.players[playerToInvest.id],
        fatigue: 85,
        fitness: 60,
      },
    },
  };
  const biomechRes = investInPlayer(state, testClubId, playerToInvest.id, "physical_transformation");
  assert(biomechRes.success, "Biomechanics & physical transformation program succeeds");
  state = biomechRes.state;
  const biomechPlayer = state.players[playerToInvest.id];
  assert(biomechPlayer.fatigue === 0, "Biomechanics completely resets player fatigue to 0");
  assert(biomechPlayer.fitness === 100, "Biomechanics restores match fitness to 100");
  assert(
    biomechPlayer.careerBuffs?.some((b) => b.type === "physical_transformation"),
    "Physical transformation career buff permanently saved on player"
  );

  // 10. Sports Psychology & Mental Toughness
  state = {
    ...state,
    players: {
      ...state.players,
      [playerToInvest.id]: {
        ...state.players[playerToInvest.id],
        form: 5.2,
        morale: 45,
      },
    },
  };
  const psychRes = investInPlayer(state, testClubId, playerToInvest.id, "sports_psychology");
  assert(psychRes.success, "Sports psychology retreat succeeds");
  state = psychRes.state;
  const psychPlayer = state.players[playerToInvest.id];
  assert(psychPlayer.morale === 100, "Sports psychology elevates player morale to 100");
  assert(psychPlayer.form >= 8.5, "Sports psychology elevates player form to 8.5+");
  assert(
    psychPlayer.careerBuffs?.some((b) => b.type === "sports_psychology"),
    "Sports psychology career buff permanently registered"
  );

  // ----------------------------------------------------
  // BREAK TEST 13: Past Seasons History & Season Archives
  // ----------------------------------------------------
  console.log("\n--- Break Test 13: Past Seasons History & Season Archives ---");
  assert(Array.isArray(state.seasonHistory), "Season history array initialized on manager state");
  assert(state.seasonHistory!.length === 0, "Season history starts empty in Season 1");

  // Advance calendar to season_end phase
  state = {
    ...state,
    calendar: {
      ...state.calendar,
      currentWeek: 32,
      phase: "season_end",
    },
  };

  // Perform Season 1 Rollover (2026 -> 2027)
  const rollover1 = rolloverSeason(state);
  state = rollover1.state;

  assert(state.calendar.currentSeason === 2027, "Season advanced to 2027");
  assert(state.seasonHistory != null && state.seasonHistory.length === 1, "Exactly 1 season archived in history");

  const s1Archive = state.seasonHistory![0];
  assert(s1Archive.season === 2026, "Archived record represents Season 2026");
  assert(typeof s1Archive.superLeagueChampion === "string" && s1Archive.superLeagueChampion.length > 0, "Super League champion recorded");
  assert(typeof s1Archive.championshipChampion === "string" && s1Archive.championshipChampion.length > 0, "Championship champion recorded");
  assert(s1Archive.promotedClubs.length >= 1, "At least 1 promoted club recorded");
  assert(s1Archive.relegatedClubs.length >= 1, "At least 1 relegated club recorded");
  assert(s1Archive.tables.superLeague.length === 14, "Super League table snapshot contains all 14 clubs");
  assert(s1Archive.tables.championship.length === 14, "Championship table snapshot contains all 14 clubs");
  assert(s1Archive.userClub.clubId === testClubId, "User club recorded in season archive");
  assert(s1Archive.userClub.finishPosition >= 1 && s1Archive.userClub.finishPosition <= 14, "User club finish position valid");

  // Verify save/load serialization of season history
  const serializedHistory = exportSaveToJson(state);
  const reloadedHistory = importSaveFromJson(serializedHistory);
  assert(reloadedHistory != null, "State with season history serializes and deserializes cleanly");
  assert(reloadedHistory!.seasonHistory?.length === 1, "Reloaded state preserves archived season history length");
  assert(reloadedHistory!.seasonHistory![0].season === 2026, "Reloaded history preserves season year 2026");
  assert(
    reloadedHistory!.seasonHistory![0].superLeagueChampion === s1Archive.superLeagueChampion,
    "Reloaded history preserves champions"
  );

  // Perform Season 2 Rollover (2027 -> 2028)
  state = {
    ...state,
    calendar: {
      ...state.calendar,
      currentWeek: 32,
      phase: "season_end",
    },
  };

  const rollover2 = rolloverSeason(state);
  state = rollover2.state;

  assert(state.calendar.currentSeason === 2028, "Season advanced to 2028");
  assert(state.seasonHistory!.length === 2, "Both completed seasons archived in chronological order");
  assert(state.seasonHistory![0].season === 2026, "First archive entry is Season 2026");
  assert(state.seasonHistory![1].season === 2027, "Second archive entry is Season 2027");

  // Verify division separation of individual accolades
  const testAwardsState = JSON.parse(JSON.stringify(state));
  const slPlayer = Object.values(testAwardsState.players).find(
    (p: any) => testAwardsState.clubs[p.clubId]?.competitionId === "super-league"
  ) as any;
  const champPlayer = Object.values(testAwardsState.players).find(
    (p: any) => testAwardsState.clubs[p.clubId]?.competitionId === "championship"
  ) as any;

  slPlayer.stats.motm = 4;
  slPlayer.stats.tries = 15;
  champPlayer.stats.motm = 8;
  champPlayer.stats.tries = 20;

  const sepAwards = calculateSeasonAwards(testAwardsState);
  assert(
    sepAwards.manOfSteel?.name === slPlayer.name,
    "Man of Steel is strictly awarded to Super League player despite Champ player having more MOTMs"
  );
  assert(
    sepAwards.championshipPlayerOfYear?.name === champPlayer.name,
    "Championship POTY is awarded to Championship player with top MOTMs"
  );
  assert(
    sepAwards.topTryScorer?.name === slPlayer.name,
    "Super League Top Try Scorer is strictly awarded to Super League player"
  );
  assert(
    sepAwards.championshipTopTryScorer?.name === champPlayer.name,
    "Championship Top Try Scorer is strictly awarded to Championship player"
  );

  // Verify RFL Season Review Email Formatting & Accuracy
  const s2Email = state.inbox.messages.find((m) => m.id === "inbox_awards_2028");
  assert(s2Email != null, "Season 2027 Review email present in inbox for Season 2028");
  assert(s2Email!.sender === "Rugby Football League", "Email sender is Rugby Football League");
  assert(s2Email!.subject === "2027 Season Review & Roll of Honour", "Email subject is 2027 Season Review & Roll of Honour");
  assert(s2Email!.body.includes("🏆 SILVERWARE & CHAMPIONS"), "Email contains Silverware & Champions section");
  assert(s2Email!.body.includes("⬆️ PROMOTION & RELEGATION"), "Email contains Promotion & Relegation section");
  assert(s2Email!.body.includes("Automatic Promotion to Super League:"), "Email contains Automatic Promotion details");
  assert(s2Email!.body.includes("Automatic Relegation to Championship:"), "Email contains Automatic Relegation details");
  assert(s2Email!.body.includes("📋 CONFIRMED FOR NEXT SEASON"), "Email contains Confirmed for Next Season lineup");
  assert(s2Email!.body.includes("⭐ INDIVIDUAL HONOURS"), "Email contains Individual Honours section");

  // Verify Million Pound Game outcome formatting in RFL email builder
  const mockAwardsMpgSurvived = {
    ...sepAwards,
    superLeagueChampion: "Wigan Warriors",
    championshipChampion: "Widnes Vikings",
    autoPromotedClub: "Widnes Vikings",
    autoRelegatedClub: "Castleford Tigers",
    promotedClubs: ["Widnes Vikings"],
    relegatedClubs: ["Castleford Tigers"],
    millionPoundGame: {
      superLeagueTeam: "Bradford Bulls",
      championshipTeam: "Featherstone Rovers",
      superLeagueScore: 26,
      championshipScore: 18,
      winner: "Bradford Bulls",
      score: "26 - 18",
      superLeagueSurvived: true,
    },
  };
  const emailMpgSurvived = buildRflSeasonReviewEmail(2027, mockAwardsMpgSurvived);
  assert(
    emailMpgSurvived.body.includes("Bradford Bulls 26 - 18 Featherstone Rovers"),
    "MPG score accurately formatted in RFL email"
  );
  assert(
    emailMpgSurvived.body.includes("retained Super League status"),
    "MPG survivor outcome accurately stated"
  );

  const mockAwardsMpgPromoted = {
    ...sepAwards,
    superLeagueChampion: "Wigan Warriors",
    championshipChampion: "Widnes Vikings",
    autoPromotedClub: "Widnes Vikings",
    autoRelegatedClub: "Castleford Tigers",
    promotedClubs: ["Widnes Vikings", "Featherstone Rovers"],
    relegatedClubs: ["Castleford Tigers", "Bradford Bulls"],
    millionPoundGame: {
      superLeagueTeam: "Bradford Bulls",
      championshipTeam: "Featherstone Rovers",
      superLeagueScore: 14,
      championshipScore: 22,
      winner: "Featherstone Rovers",
      score: "14 - 22",
      superLeagueSurvived: false,
    },
  };
  const emailMpgPromoted = buildRflSeasonReviewEmail(2027, mockAwardsMpgPromoted);
  assert(
    emailMpgPromoted.body.includes("achieve promotion to Super League"),
    "MPG promotion outcome accurately stated"
  );
  assert(
    emailMpgPromoted.body.includes("Bradford Bulls are relegated to the Championship"),
    "MPG relegation outcome accurately stated"
  );

  // Verify formatRflSeasonReviewFromBodyRecord reconstruction
  const reconstructedBody = formatRflSeasonReviewFromBodyRecord(state.seasonHistory![1]);
  assert(reconstructedBody.includes("2027 Rugby Football League season"), "Reconstructed email includes season year");
  assert(reconstructedBody.includes("PROMOTION & RELEGATION"), "Reconstructed email includes promotion and relegation");

  // =========================================================================
  // BREAK TEST 14: Save Slots, Metadata Caching & Save Management
  // =========================================================================
  console.log("\n--- Break Test 14: Save Slots, Metadata Caching & Save Management ---");
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as any).window = {
    localStorage: mockStorage,
    sessionStorage: mockStorage,
  };

  // Initially no saves exist
  assert(getAllAvailableSaves().length === 0, "Initially zero saves in storage");
  assert(getMostRecentSave() === null, "No most recent save when storage empty");

  // Save state to Slot 0
  const save0Result = saveManagerState(state, 0);
  assert(save0Result.success, "Save to Slot 0 succeeds");

  // Check metadata cached
  const meta0 = getSaveSlotMetadata(0);
  assert(meta0 !== null, "Metadata retrieved for Slot 0");
  assert(meta0?.clubName === state.clubs[testClubId].name, "Metadata club name matches user club");
  assert(meta0?.season === state.calendar.currentSeason, "Metadata season matches current season");
  assert(meta0?.week === state.calendar.currentWeek, "Metadata week matches current week");
  assert(meta0?.divisionName === "Championship", "Metadata division correctly identified");

  // Check available saves list
  const available1 = getAllAvailableSaves();
  assert(available1.length === 1, "Exactly 1 save returned in available saves");
  assert(available1[0].slot === 0, "Slot 0 present in available saves");

  // Create another club state and save to Slot 2
  const stateWigan = initializeManagerDatabase("wigan-warriors", "Coach Peet");
  const save2Result = saveManagerState(stateWigan, 2);
  assert(save2Result.success, "Save to Slot 2 succeeds");

  const available2 = getAllAvailableSaves();
  assert(available2.length === 2, "Now exactly 2 saves in storage (Slot 0 and Slot 2)");

  const meta2 = getSaveSlotMetadata(2);
  assert(meta2 !== null, "Metadata retrieved for Slot 2");
  assert(meta2?.clubName === "Wigan Warriors", "Slot 2 club name is Wigan Warriors");
  assert(meta2?.divisionName === "Super League", "Slot 2 division is Super League");

  // Most recent save is Slot 2 (most recently written)
  const recent = getMostRecentSave();
  assert(recent !== null, "Most recent save found");
  assert(recent?.slot === 2, "Most recent save is Slot 2");
  assert(recent?.clubName === "Wigan Warriors", "Most recent save club is Wigan Warriors");

  // Test loading from slot
  const loadedWigan = loadManagerState(2);
  assert(loadedWigan !== null, "Slot 2 loads valid state");
  assert(loadedWigan?.manager.clubId === "wigan-warriors", "Loaded state has correct club id");

  // Delete Slot 0
  const delete0 = deleteSaveSlot(0);
  assert(delete0, "Deleting Slot 0 succeeds");
  assert(loadManagerState(0) === null, "Slot 0 no longer loads state");
  assert(getSaveSlotMetadata(0) === null, "Slot 0 metadata cleared");

  const availableAfterDelete = getAllAvailableSaves();
  assert(availableAfterDelete.length === 1, "Only 1 save remains after deleting Slot 0");
  assert(availableAfterDelete[0].slot === 2, "Remaining save is Slot 2");

  // Clean up global window
  delete (globalThis as any).window;

  // ----------------------------------------------------
  // BREAK TEST 15: Loaned-out players must not play for parent
  // ----------------------------------------------------
  console.log("\n--- Break Test 15: Loan Availability & Transfer Clears Loan ---");
  let loanState = initializeManagerDatabase("wigan-warriors", "Loan Breaker");
  const parentId = "wigan-warriors";
  const destId = "widnes-vikings";
  const loanPlayer = Object.values(loanState.players).find(
    (p) =>
      p.clubId === parentId &&
      p.squadTier === "first" &&
      !p.loan &&
      !p.injury &&
      !p.suspension
  );
  assert(!!loanPlayer, "Found a loanable first-team player at Wigan");

  const loanOut = createLoanAgreement(loanState, parentId, destId, loanPlayer!.id, 10, 50, true);
  assert(loanOut.success, "Loan out to Championship club succeeds");
  loanState = loanOut.state;
  const onLoan = loanState.players[loanPlayer!.id];
  assert(!!onLoan.loan, "Player has active loan record");
  assert(
    !isPlayerAvailableForClub(onLoan, parentId),
    "Loaned-out player is NOT available for parent club"
  );
  assert(
    isPlayerAvailableForClub(onLoan, destId),
    "Loaned-out player IS available for destination club"
  );

  // Force parent lineup to still name the loaned player and ensure clean strips them
  const parentClub = loanState.clubs[parentId];
  loanState = {
    ...loanState,
    clubs: {
      ...loanState.clubs,
      [parentId]: {
        ...parentClub,
        lineup: {
          starting13: parentClub.lineup.starting13.map((id, i) => (i === 0 ? onLoan.id : id)),
          bench: parentClub.lineup.bench,
        },
      },
    },
  };
  loanState = cleanAllClubLineups(loanState);
  const cleanedParent = loanState.clubs[parentId];
  const stillNamed = [...cleanedParent.lineup.starting13, ...cleanedParent.lineup.bench].includes(
    onLoan.id
  );
  assert(!stillNamed, "cleanAllClubLineups removes loaned-out player from parent 17");

  const forceSelect = setClubLineup(loanState, parentId, {
    starting13: parentClub.lineup.starting13.map((id, i) => (i === 0 ? onLoan.id : id)),
    bench: parentClub.lineup.bench,
  });
  assert(!forceSelect.success, "setClubLineup rejects loaned-out player for parent");

  // Inject an accepted bid and complete — proves permanent move clears loan state
  const fakeBidId = `bid_loan_clear_${onLoan.id}`;
  // Free salary-cap room at buyer so the transfer can complete
  const buyerId = "st-helens";
  const buyerPlayersPatched = { ...loanState.players };
  for (const [pid, p] of Object.entries(buyerPlayersPatched)) {
    if (p.clubId === buyerId && p.contract) {
      buyerPlayersPatched[pid] = {
        ...p,
        contract: { ...p.contract, wageWeekly: 100 },
      };
    }
  }
  loanState = {
    ...loanState,
    players: buyerPlayersPatched,
    clubs: {
      ...loanState.clubs,
      [buyerId]: {
        ...loanState.clubs[buyerId],
        finances: {
          ...loanState.clubs[buyerId].finances,
          balance: 50_000_000,
        },
      },
    },
    transfers: {
      ...loanState.transfers,
      activeBids: [
        {
          id: fakeBidId,
          season: loanState.calendar.currentSeason,
          week: loanState.calendar.currentWeek,
          playerId: onLoan.id,
          fromClubId: buyerId,
          toClubId: parentId,
          offeredFee: 50_000,
          offeredWage: 100,
          offeredRole: "rotation",
          offeredContractYears: 2,
          status: "player_accepted",
        },
        ...loanState.transfers.activeBids,
      ],
    },
  };
  const done = completeTransfer(loanState, fakeBidId);
  assert(done.success, `Transfer of loaned player completes (${done.error || "ok"})`);
  loanState = done.state;
  const moved = loanState.players[onLoan.id];
  assert(moved.loan === null, "Completed transfer clears player.loan");
  assert(moved.clubId === buyerId, "Player now belongs to buying club");
  assert(
    !(loanState.transfers.activeLoans || []).some((l) => l.playerId === onLoan.id),
    "activeLoans no longer lists transferred player"
  );

  // Auto-pick pulls from reserves/academy when first team is short
  let depthState = initializeManagerDatabase("widnes-vikings", "Depth Test");
  const ft = Object.values(depthState.players).filter(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "first" && !p.loan
  );
  // Injure most of first team
  for (const p of ft.slice(0, Math.max(0, ft.length - 8))) {
    depthState = {
      ...depthState,
      players: {
        ...depthState.players,
        [p.id]: {
          ...p,
          injury: { type: "Knock", weeksRemaining: 4, severity: "moderate" },
        },
      },
    };
  }
  const auto = autoPickClubLineup(depthState, "widnes-vikings");
  assert(auto.success, "Auto-pick succeeds by promoting from reserves/academy when FT is injured");
  const autoReady = getMatchdayLineupReadiness(auto.state, "widnes-vikings");
  assert(autoReady.ready, "Auto-pick produces a matchday-ready 17");

  // ----------------------------------------------------
  // BREAK TEST 16: League end-of-season objectives & youth graduates
  // ----------------------------------------------------
  console.log("\n--- Break Test 16: Board Objectives Settlement ---");

  let objState = initializeManagerDatabase("wigan-warriors", "Objective Tester");
  const wigan = objState.clubs["wigan-warriors"];
  const leagueObj = (wigan.boardObjectives || []).find((o) => o.category === "league")!;
  assert(!!leagueObj, "Wigan has a league board objective");
  assert(
    /grand final|top 6|relegation/i.test(leagueObj.title),
    `Wigan league objective is a known title (${leagueObj.title})`
  );

  // Mid-season: do NOT complete Grand Final / Top 6 objectives from a good early table
  const sl = objState.competitions["super-league"];
  objState = {
    ...objState,
    calendar: { ...objState.calendar, phase: "regular_season", currentWeek: 10 },
    competitions: {
      ...objState.competitions,
      "super-league": {
        ...sl,
        standings: sl.standings.map((row) =>
          row.clubId === "wigan-warriors"
            ? { ...row, played: 8, points: 16, pointsDifference: 40 }
            : { ...row, played: 8, points: Math.max(0, (row.points || 0) - 4) }
        ),
      },
    },
  };
  // Force Wigan to rank 1 mid-season
  const midStandings = [...objState.competitions["super-league"].standings].sort((a, b) => {
    if (a.clubId === "wigan-warriors") return -1;
    if (b.clubId === "wigan-warriors") return 1;
    return b.points - a.points;
  });
  // Assign descending points so Wigan is clearly 1st
  const forced = midStandings.map((row, idx) => ({
    ...row,
    played: 8,
    points: 30 - idx,
    pointsDifference: 50 - idx * 2,
  }));
  // Put Wigan first explicitly
  const wiganRow = forced.find((r) => r.clubId === "wigan-warriors")!;
  const others = forced.filter((r) => r.clubId !== "wigan-warriors");
  objState = {
    ...objState,
    competitions: {
      ...objState.competitions,
      "super-league": {
        ...objState.competitions["super-league"],
        standings: [
          { ...wiganRow, played: 8, points: 30, pointsDifference: 80 },
          ...others.map((r, i) => ({ ...r, played: 8, points: 28 - i, pointsDifference: 40 - i })),
        ],
      },
    },
  };

  assert(
    !isRegularSeasonSettled(objState, objState.competitions["super-league"]),
    "Week 10 with 8 games each is NOT regular-season settled"
  );
  const midClub = refreshClubBoardObjectives(objState, "wigan-warriors");
  const midLeague = midClub.boardObjectives.find((o) => o.category === "league")!;
  assert(
    midLeague.currentValue === 1,
    "Mid-season league objective tracks rank 1"
  );
  if (/grand final|top 6/i.test(midLeague.title)) {
    assert(
      !midLeague.isCompleted && !midLeague.isFailed,
      "Grand Final / Top 6 objectives do not settle mid-season"
    );
  }

  // End of regular season: top-4 / top-6 completes
  objState = {
    ...objState,
    calendar: { ...objState.calendar, phase: "playoffs", currentWeek: 29 },
    clubs: { ...objState.clubs, "wigan-warriors": midClub },
  };
  assert(
    isRegularSeasonSettled(objState, objState.competitions["super-league"]),
    "Playoffs phase marks regular season settled"
  );
  const endClub = refreshClubBoardObjectives(objState, "wigan-warriors");
  const endLeague = endClub.boardObjectives.find((o) => o.category === "league")!;
  if (/grand final/i.test(endLeague.title)) {
    assert(endLeague.isCompleted, "Compete for Grand Final completes in top 4 after RS");
  } else if (/top\s*6|play-?off/i.test(endLeague.title)) {
    assert(endLeague.isCompleted, "Top 6 playoff objective completes when ranked top 6 after RS");
  }

  // Youth: promote academy graduate, give apps, still counts
  let youthState = initializeManagerDatabase("widnes-vikings", "Youth Tester");
  const academyKid = Object.values(youthState.players).find(
    (p) => p.clubId === "widnes-vikings" && p.squadTier === "academy"
  );
  assert(!!academyKid, "Found academy prospect");
  assert(
    academyKid!.academyProductOfClubId === "widnes-vikings",
    "New academy players are tagged as academy products"
  );
  const promoted = movePlayerTier(youthState, academyKid!.id, "first");
  assert(promoted.success, "Promote academy kid to first team");
  youthState = promoted.state;
  const grad = youthState.players[academyKid!.id];
  assert(
    grad.academyProductOfClubId === "widnes-vikings",
    "Graduate keeps academyProductOfClubId after promotion"
  );
  assert(grad.squadTier === "first", "Graduate is now first team");

  youthState = {
    ...youthState,
    players: {
      ...youthState.players,
      [grad.id]: {
        ...grad,
        stats: { ...grad.stats, apps: 5 },
      },
    },
  };
  assert(
    countAcademyGraduateFirstTeamApps(youthState, "widnes-vikings") >= 5,
    "Graduate first-team apps count toward youth objective"
  );
  const youthClub = refreshClubBoardObjectives(youthState, "widnes-vikings");
  const youthObj = youthClub.boardObjectives.find((o) => o.category === "youth")!;
  assert(youthObj.isCompleted, "Youth objective completes when graduate apps hit target");
  assert(
    Number(youthObj.currentValue) >= 5,
    "Youth currentValue reflects graduate appearance total"
  );

  // Avoid Relegation mid-season must not complete just for being mid-table early
  let relState = initializeManagerDatabase("salford-rlfc", "Rel Tester");
  // Force Salford into bottom reputation avoid-relegation style objective if needed
  const salfordObj = {
    ...(relState.clubs["salford-rlfc"].boardObjectives.find((o) => o.category === "league") || {
      id: "test_rel",
      title: "Avoid Relegation",
      description: "Stay up",
      category: "league" as const,
      targetValue: 13,
      currentValue: 1,
      isCompleted: false,
      isFailed: false,
      importance: "high" as const,
    }),
    title: "Avoid Relegation",
    targetValue: 13,
    isCompleted: false,
    isFailed: false,
  };
  relState = {
    ...relState,
    calendar: { ...relState.calendar, phase: "regular_season", currentWeek: 12 },
    clubs: {
      ...relState.clubs,
      "salford-rlfc": {
        ...relState.clubs["salford-rlfc"],
        boardObjectives: [
          salfordObj,
          ...relState.clubs["salford-rlfc"].boardObjectives.filter((o) => o.category !== "league"),
        ],
      },
    },
    competitions: {
      ...relState.competitions,
      "super-league": {
        ...relState.competitions["super-league"],
        standings: relState.competitions["super-league"].standings.map((row, i) => ({
          ...row,
          played: 10,
          points: row.clubId === "salford-rlfc" ? 12 : 20 - (i % 10),
          pointsDifference: row.clubId === "salford-rlfc" ? -10 : 10 - i,
        })),
      },
    },
  };
  const relMid = refreshClubBoardObjectives(relState, "salford-rlfc");
  const relLeague = relMid.boardObjectives.find((o) => o.category === "league")!;
  assert(!relLeague.isCompleted, "Avoid Relegation does not complete mid-season");
  assert(!relLeague.isFailed, "Avoid Relegation does not fail mid-season when clear of bottom");

  console.log("\n========================================================");
  console.log(`ALL BREAK TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

runBreakTests().catch((err) => {
  console.error("FATAL ERROR IN BREAK TEST:", err);
  process.exit(1);
});
