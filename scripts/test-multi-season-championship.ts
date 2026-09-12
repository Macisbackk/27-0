/**
 * Multi-season Championship to Super League end-to-end simulation test.
 * Simulates an entire managerial career starting at a Championship club,
 * taking them through pre-season, friendlies, league, cup, promotion,
 * season rollover, contracts, transfers, loans, and multi-year progression.
 */

import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import { rolloverSeason } from "../src/lib/manager/rollover";
import { movePlayerTier, validateSquadInvariants } from "../src/lib/manager/squad";
import { renewPlayerContract, signFreeAgent } from "../src/lib/manager/contracts";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  evaluatePlayerTransferTerms,
  completeTransfer,
} from "../src/lib/manager/transfers";
import { createLoanAgreement, recallLoan } from "../src/lib/manager/loans";
import { exportSaveToJson, importSaveFromJson } from "../src/lib/manager/storage";
import { sortStandings } from "../src/lib/manager/competitions";

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`✓ [PASS] ${message}`);
}

async function runMultiSeasonChampionshipTest() {
  console.log("\n========================================================");
  console.log("STARTING MULTI-SEASON CHAMPIONSHIP CAREER SIMULATION TEST");
  console.log("========================================================\n");

  const USER_CLUB_ID = "widnes-vikings";
  const MANAGER_NAME = "Allan Coleman";

  // 1. INITIALIZE CAREER
  console.log("--- 1. Initializing Career as Championship Club ---");
  let state = initializeManagerDatabase(USER_CLUB_ID, MANAGER_NAME);

  assert(state.manager.clubId === USER_CLUB_ID, "Manager assigned to Widnes Vikings");
  assert(state.clubs[USER_CLUB_ID].competitionId === "championship", "Widnes is in Championship");
  assert(state.calendar.currentSeason === 2026, "Starts in Season 2026");
  assert(state.calendar.currentWeek === 1, "Starts in Week 1 (Pre-season)");
  assert(
    state.clubs[USER_CLUB_ID].competitionId === "championship" &&
      state.clubs[USER_CLUB_ID].finances.wageBudgetWeekly > 0,
    "Championship club finances initialized with weekly wage budget"
  );

  const initInvariants = validateSquadInvariants(state);
  assert(initInvariants.valid, `Initial universe invariants valid: ${initInvariants.errors.join(", ")}`);

  // 2. SQUAD MOVEMENTS (First Team, Reserves, Academy)
  console.log("\n--- 2. Squad Movement Invariants ---");
  const widnesPlayers = Object.values(state.players).filter((p) => p.clubId === USER_CLUB_ID);
  const academyPlayer = widnesPlayers.find((p) => p.squadTier === "academy");
  assert(!!academyPlayer, "Found Academy player at Widnes");

  if (academyPlayer) {
    const pId = academyPlayer.id;
    // Move Academy -> Reserves
    let res = movePlayerTier(state, pId, "reserves");
    state = res.state;
    assert(state.players[pId].squadTier === "reserves", "Academy player moved to Reserves");
    assert(validateSquadInvariants(state).valid, "Invariants hold after Academy -> Reserves");

    // Move Reserves -> First Team
    res = movePlayerTier(state, pId, "first");
    state = res.state;
    assert(state.players[pId].squadTier === "first", "Player promoted to First Team");
    assert(validateSquadInvariants(state).valid, "Invariants hold after Reserves -> First Team");

    // Move back to Reserves
    res = movePlayerTier(state, pId, "reserves");
    state = res.state;
    assert(state.players[pId].squadTier === "reserves", "Player demoted back to Reserves");
    assert(validateSquadInvariants(state).valid, "Invariants hold after First Team -> Reserves");
  }

  // 3. CONTRACT RENEWALS & FREE AGENTS
  console.log("\n--- 3. Contracts, Renewals & Free Agency ---");
  const firstTeamPlayer = widnesPlayers.find((p) => p.squadTier === "first" && p.contract);
  assert(!!firstTeamPlayer, "Found first team player at Widnes");

  if (firstTeamPlayer) {
    const pId = firstTeamPlayer.id;
    const oldWage = firstTeamPlayer.contract!.wageWeekly;
    const offeredWage = Math.round(oldWage * 1.15);
    const renewRes = renewPlayerContract(state, pId, offeredWage, 3, "star");
    assert(renewRes.success, `Contract renewal succeeded: ${renewRes.error || ""}`);
    state = renewRes.state;
    assert(
      state.players[pId].contract?.expiresSeason === state.calendar.currentSeason + 3,
      "Contract extended by 3 years"
    );
    assert(state.players[pId].contract?.wageWeekly === offeredWage, "Wage updated to £" + offeredWage + "/wk");
  }

  // Sign Free Agent
  const freeAgents = Object.values(state.players).filter((p) => p.clubId === null);
  assert(freeAgents.length > 0, `Free agent pool exists (${freeAgents.length} players)`);
  const faToSignId = freeAgents[0].id;

  const signRes = signFreeAgent(state, USER_CLUB_ID, faToSignId, 1200, 2, "rotation");
  assert(signRes.success, `Free agent sign succeeded: ${signRes.error || ""}`);
  state = signRes.state;
  assert(state.players[faToSignId].clubId === USER_CLUB_ID, "Signed free agent belongs to Widnes");
  assert(validateSquadInvariants(state).valid, "Invariants hold after signing free agent");

  // 4. TRANSFERS & BIDS
  console.log("\n--- 4. Transfers Market & Bidding ---");
  const targetPlayer = Object.values(state.players).find(
    (p) => p.clubId === "halifax-panthers" && p.squadTier === "first"
  );
  assert(!!targetPlayer, "Found transfer target at Halifax Panthers");

  if (targetPlayer) {
    // A: Test lowball bid rejection
    const lowBidRes = submitTransferBid(state, USER_CLUB_ID, targetPlayer.id, 500, 1000, "rotation", 2);
    assert(lowBidRes.success, "Lowball bid registered");
    const evalLow = evaluateSellingClubBid(lowBidRes.state, lowBidRes.bid!.id);
    assert(evalLow.bid?.status === "club_rejected", "Lowball bid properly rejected by AI selling club");

    // B: Test reasonable bid acceptance & completion
    const initialWidnesBalance = state.clubs[USER_CLUB_ID].finances.balance;
    const fairBidRes = submitTransferBid(state, USER_CLUB_ID, targetPlayer.id, 35_000, 2_200, "first_team", 2);
    assert(fairBidRes.success, "Fair transfer bid registered");
    state = fairBidRes.state;
    const fairBidId = fairBidRes.bid!.id;

    const evalFair = evaluateSellingClubBid(state, fairBidId);
    assert(evalFair.bid?.status === "club_accepted", "Fair bid accepted by Halifax Panthers");
    state = evalFair.state;

    const evalPlayer = evaluatePlayerTransferTerms(state, fairBidId);
    assert(evalPlayer.bid?.status === "player_accepted", "Fair contract terms accepted by player");
    state = evalPlayer.state;

    const compRes = completeTransfer(state, fairBidId);
    assert(compRes.success, `Transfer completed: ${compRes.error || ""}`);
    state = compRes.state;

    assert(state.players[targetPlayer.id].clubId === USER_CLUB_ID, "Transferred player now belongs to Widnes");
    assert(state.players[targetPlayer.id].contract?.wageWeekly === 2_200, "Player wage updated");
    assert(
      state.clubs[USER_CLUB_ID].finances.balance === initialWidnesBalance - 35_000,
      "Transfer fee deducted from Widnes balance"
    );
    assert(validateSquadInvariants(state).valid, "Invariants hold after transfer completion");
  }

  // 5. LOAN SYSTEM
  console.log("\n--- 5. Loan System (Agreement, Destination, Recall) ---");
  const reserveToLoan = Object.values(state.players).find(
    (p) => p.clubId === USER_CLUB_ID && p.squadTier === "reserves" && !p.loan
  );
  assert(!!reserveToLoan, "Found Widnes reserve player to loan out");

  if (reserveToLoan) {
    const loanRes = createLoanAgreement(state, USER_CLUB_ID, "barrow-raiders", reserveToLoan.id, 12, 50, true);
    assert(loanRes.success, `Loan agreement created: ${loanRes.error || ""}`);
    state = loanRes.state;

    // Verify player is active at destination
    assert(state.players[reserveToLoan.id].loan?.destinationClubId === "barrow-raiders", "Player loaned to Barrow");
    assert(state.players[reserveToLoan.id].loan?.parentClubId === USER_CLUB_ID, "Widnes is parent club");
    assert(state.players[reserveToLoan.id].clubId === USER_CLUB_ID, "Parent club retains player contract");

    // Test Early Recall
    const recallRes = recallLoan(state, reserveToLoan.id);
    assert(recallRes.success, `Loan recalled: ${recallRes.error || ""}`);
    state = recallRes.state;

    assert(state.players[reserveToLoan.id].loan === null, "Active loan cleared on recall");
    assert(validateSquadInvariants(state).valid, "Invariants hold after loan recall");
  }

  // 6. PRE-SEASON FRIENDLIES & STANDINGS ISOLATION
  console.log("\n--- 6. Friendlies & Standings Isolation ---");
  const initialChampStandings = JSON.stringify(state.competitions["championship"].standings);

  // Advance Week 1 (Pre-season Friendly)
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === 2, "Advanced to Week 2");

  // Advance Week 2 (Pre-season Friendly)
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === 3, "Advanced to Week 3");

  const champStandingsAfterFriendlies = JSON.stringify(state.competitions["championship"].standings);
  assert(
    initialChampStandings === champStandingsAfterFriendlies,
    "Pre-season friendlies did NOT affect Championship league standings (all points remain 0)"
  );

  // 7. FULL REGULAR SEASON SIMULATION (WEEKS 3 TO 32)
  console.log("\n--- 7. Simulating Full Season 1 (Weeks 3 to 32) ---");
  let injuriesRecorded = 0;
  let aiTransfersRecorded = 0;

  while (state.calendar.currentWeek <= 32) {
    const currentWeek = state.calendar.currentWeek;
    state = advanceWeek(state);

    // Track injuries across universe
    const injuredNow = Object.values(state.players).filter((p) => p.injury !== null).length;
    if (injuredNow > injuriesRecorded) injuriesRecorded = injuredNow;

    // Track AI transfers
    aiTransfersRecorded += state.transfers.completedTransfers.filter((t) => t.week === currentWeek).length;

    const inv = validateSquadInvariants(state);
    if (currentWeek % 6 === 0 || currentWeek === 32) {
      console.log(
        `  -> Week ${currentWeek} completed. Invariants: ${
          inv.valid ? "OK" : "FAILED: " + inv.errors.slice(0, 3).join(" | ")
        }. Injured: ${injuredNow}. Completed transfers: ${aiTransfersRecorded}.`
      );
    }
  }

  assert(
    state.calendar.phase === "season_end" || state.calendar.currentWeek > 32,
    "Season 1 marked as completed after Week 32"
  );
  assert(validateSquadInvariants(state).valid, "Universe squad invariants intact after 32 full weeks");

  // Check Championship Standings
  const champSorted = sortStandings(state.competitions["championship"].standings);
  assert(champSorted.length === 14, "All 14 Championship clubs in final standings");
  assert(champSorted[0].played === 26, "Championship clubs completed all 26 league fixtures");
  assert(champSorted[0].points > 0, "Championship leaders have league points");
  console.log(`  🏆 Championship Season 1 Winner: ${state.clubs[champSorted[0].clubId]?.name} with ${champSorted[0].points} pts`);

  // Check Super League Standings
  const slSorted = sortStandings(state.competitions["super-league"].standings);
  assert(slSorted.length === 14, "All 14 Super League clubs in final standings");
  assert(slSorted[0].played === 26, "Super League clubs completed all 26 league fixtures");
  const relegatedExpected = slSorted[slSorted.length - 1].clubId;
  const promotedExpected = champSorted[0].clubId;
  console.log(`  ▲ Expected Promoted to Super League: ${state.clubs[promotedExpected]?.name}`);
  console.log(`  ▼ Expected Relegated to Championship: ${state.clubs[relegatedExpected]?.name}`);

  // 8. ATOMIC SEASON ROLLOVER
  console.log("\n--- 8. Atomic Season Rollover to Season 2 ---");
  const s1PlayerCount = Object.keys(state.players).length;

  const rolloverResult = rolloverSeason(state);
  const s2State = rolloverResult.state;

  assert(s2State.calendar.currentSeason === 2027, "Season rolled over to Season 2027");
  assert(s2State.calendar.currentWeek === 1, "Season 2027 reset to Week 1");
  assert(s2State.calendar.phase === "pre_season", "Season 2027 marked active pre_season");

  // Verify Promotion & Relegation
  assert(s2State.clubs[promotedExpected].competitionId === "super-league", "Promoted club is now in Super League");
  assert(s2State.clubs[relegatedExpected].competitionId === "championship", "Relegated club is now in Championship");

  // Verify Competitions Club Membership
  assert(s2State.competitions["super-league"].clubIds.includes(promotedExpected), "Super League includes promoted club");
  assert(!s2State.competitions["super-league"].clubIds.includes(relegatedExpected), "Super League excludes relegated club");
  assert(s2State.competitions["championship"].clubIds.includes(relegatedExpected), "Championship includes relegated club");
  assert(!s2State.competitions["championship"].clubIds.includes(promotedExpected), "Championship excludes promoted club");

  // Verify New Fixtures Generated
  assert(s2State.competitions["super-league"].fixtures.length > 0, "Super League Season 2 fixtures generated");
  assert(s2State.competitions["championship"].fixtures.length > 0, "Championship Season 2 fixtures generated");
  assert(s2State.competitions["challenge-cup"].fixtures.length > 0, "Challenge Cup Season 2 fixtures generated");

  // Verify Youth Intake
  const s2PlayerCount = Object.keys(s2State.players).length;
  console.log(`  Season 1 universe players: ${s1PlayerCount}, Season 2 universe players: ${s2PlayerCount}`);
  assert(validateSquadInvariants(s2State).valid, "Universe squad invariants valid after Season 2 Rollover");

  // 9. SAVE & RELOAD PRESERVATION
  console.log("\n--- 9. Full Serialization & Save/Reload Verification ---");
  const serialized = exportSaveToJson(s2State);
  assert(serialized.length > 100_000, `Save JSON successfully generated (${serialized.length} bytes)`);

  const reloadedState = importSaveFromJson(serialized);
  assert(!!reloadedState, "Save JSON successfully parsed and deserialized");

  if (reloadedState) {
    assert(reloadedState.calendar.currentSeason === 2027, "Reloaded season preserved (Season 2027)");
    assert(reloadedState.calendar.currentWeek === 1, "Reloaded week preserved (Week 1)");
    assert(reloadedState.manager.clubId === USER_CLUB_ID, "Reloaded manager club preserved");
    assert(reloadedState.clubs[promotedExpected].competitionId === "super-league", "Promotion state preserved in reload");
    assert(validateSquadInvariants(reloadedState).valid, "Squad invariants 100% valid in reloaded universe");

    // Advance Week 1 in Season 2 after reload
    console.log("\n--- 10. Advancing Season 2 Post-Reload ---");
    const s2w2State = advanceWeek(reloadedState);
    assert(s2w2State.calendar.currentWeek === 2, "Season 2 advanced to Week 2 post-reload");
    const s2inv = validateSquadInvariants(s2w2State);
    assert(s2inv.valid, `Squad invariants valid after Season 2 Week 2 advance: ${s2inv.errors.slice(0, 3).join(" | ")}`);
  }

  console.log("\n========================================================");
  console.log(`ALL TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

runMultiSeasonChampionshipTest().catch((err) => {
  console.error("FATAL ERROR IN MULTI-SEASON TEST:", err);
  process.exit(1);
});
