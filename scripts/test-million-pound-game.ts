/**
 * Dedicated End-to-End Test for The Million Pound Game & Promotion/Relegation
 *
 * Verifies:
 * 1. Automatic promotion of 1st placed Championship club.
 * 2. Automatic relegation of 14th placed Super League club.
 * 3. Championship Top 6 Playoffs (2nd-6th) leading to Playoff Final Winner.
 * 4. The Million Pound Game scheduled for Week 32 between 13th SL & Championship Playoff Winner.
 * 5. Case A: Championship team wins MPG -> 2 promoted, 2 relegated, club counts preserved (14 SL, 12 Champ).
 * 6. Case B: Super League team wins MPG -> 1 promoted, 1 relegated, 13th SL survives, club counts preserved.
 */

import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import { rolloverSeason, calculateSeasonAwards } from "../src/lib/manager/rollover";
import { sortStandings } from "../src/lib/manager/competitions";
import { validateSquadInvariants } from "../src/lib/manager/squad";

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

async function runMillionPoundGameTests() {
  console.log("\n========================================================");
  console.log("STARTING THE MILLION POUND GAME & PROMOTION/RELEGATION TEST");
  console.log("========================================================\n");

  let state = initializeManagerDatabase("castleford-tigers", "Craig Lingard");

  // Advance to week 28 (end of regular season)
  console.log("--- 1. Simulating Regular Season up to Week 28 ---");
  while (state.calendar.currentWeek <= 28) {
    state = advanceWeek(state);
  }

  assert(state.calendar.currentWeek === 29, "Advanced to Week 29 (Playoff Eliminators)");
  assert(state.calendar.phase === "playoffs", "Calendar phase transitioned to playoffs");

  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  const autoPromotedChamp = champStandings[0].clubId;
  const autoRelegatedSL = slStandings[13].clubId;
  const mpgSL13 = slStandings[12].clubId;

  console.log(`  ▲ 1st Championship (Auto Promoted): ${state.clubs[autoPromotedChamp]?.name}`);
  console.log(`  ▼ 14th Super League (Auto Relegated): ${state.clubs[autoRelegatedSL]?.name}`);
  console.log(`  ⚔️ 13th Super League (MPG Participant): ${state.clubs[mpgSL13]?.name}`);

  // Check week 29 fixtures scheduled
  const slW29Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === 29);
  const champW29Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === 29);

  assert(slW29Fixtures.length === 2, "Super League has 2 Eliminator fixtures at Week 29");
  assert(champW29Fixtures.length === 2, "Championship has 2 Eliminator fixtures at Week 29");

  // Advance Week 29 (Eliminators played)
  console.log("\n--- 2. Simulating Week 29 Eliminators ---");
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === 30, "Advanced to Week 30 (Semi-Finals)");

  // Check week 30 Semi-Finals scheduled
  const slW30Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === 30);
  const champW30Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === 30);
  assert(slW30Fixtures.length === 2, "Super League has 2 Semi-Final fixtures at Week 30");
  assert(champW30Fixtures.length === 2, "Championship has 2 Semi-Final fixtures at Week 30");

  // Advance Week 30 (Semi-Finals played)
  console.log("\n--- 3. Simulating Week 30 Semi-Finals ---");
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === 31, "Advanced to Week 31 (Finals)");

  // Check week 31 Finals scheduled
  const slW31Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === 31);
  const champW31Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === 31);
  assert(slW31Fixtures.length === 1, "Super League has Grand Final fixture at Week 31");
  assert(champW31Fixtures.length === 1, "Championship has Playoff Final fixture at Week 31");

  // Advance Week 31 (Finals played)
  console.log("\n--- 4. Simulating Week 31 Finals & Scheduling The Million Pound Game ---");
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === 32, "Advanced to Week 32 (The Million Pound Game)");

  // Verify The Million Pound Game is scheduled in Week 32
  const mpgFixture = state.competitions["super-league"].fixtures.find(
    (f) => f.week === 32 && f.roundName === "The Million Pound Game"
  );
  assert(!!mpgFixture, "The Million Pound Game fixture exists at Week 32");
  assert(mpgFixture?.homeClubId === mpgSL13, `Home club in MPG is 13th SL club (${state.clubs[mpgSL13]?.name})`);

  const champPlayoffWinner = mpgFixture!.awayClubId;
  console.log(`  🏆 Championship Playoff Final Winner: ${state.clubs[champPlayoffWinner]?.name}`);
  assert(champPlayoffWinner !== autoPromotedChamp, "Championship Playoff Winner is distinct from 1st placed auto-promoted team");

  // ----------------------------------------------------
  // TEST SCENARIO A: Championship Team Wins The Million Pound Game
  // ----------------------------------------------------
  console.log("\n--- 5. Scenario A: Championship Club Wins The Million Pound Game ---");
  const stateScenarioA = JSON.parse(JSON.stringify(state));

  // Find MPG fixture and simulate Championship win (e.g. SL 12 - 24 Champ)
  const mpgIndex = stateScenarioA.competitions["super-league"].fixtures.findIndex(
    (f: any) => f.roundName === "The Million Pound Game"
  );
  stateScenarioA.competitions["super-league"].fixtures[mpgIndex] = {
    ...stateScenarioA.competitions["super-league"].fixtures[mpgIndex],
    isPlayed: true,
    homeScore: 12,
    awayScore: 24,
  };

  const awardsA = calculateSeasonAwards(stateScenarioA);
  assert(awardsA.millionPoundGame !== null, "Awards include Million Pound Game details");
  assert(awardsA.millionPoundGame?.superLeagueSurvived === false, "Super League club did NOT survive");
  assert(awardsA.promotedClubIds.includes(autoPromotedChamp), "1st Champ auto-promoted");
  assert(awardsA.promotedClubIds.includes(champPlayoffWinner), "Championship Playoff Winner promoted via MPG");
  assert(awardsA.relegatedClubIds.includes(autoRelegatedSL), "14th SL auto-relegated");
  assert(awardsA.relegatedClubIds.includes(mpgSL13), "13th SL relegated via MPG");

  const rolloverA = rolloverSeason(stateScenarioA);
  const nextSeasonA = rolloverA.state;

  assert(nextSeasonA.clubs[autoPromotedChamp].competitionId === "super-league", "Auto-promoted club in Super League");
  assert(nextSeasonA.clubs[champPlayoffWinner].competitionId === "super-league", "MPG winner promoted to Super League");
  assert(nextSeasonA.clubs[autoRelegatedSL].competitionId === "championship", "Auto-relegated club in Championship");
  assert(nextSeasonA.clubs[mpgSL13].competitionId === "championship", "13th SL relegated to Championship");

  const s2SlClubsA = Object.values(nextSeasonA.clubs).filter((c) => c.competitionId === "super-league");
  const s2ChampClubsA = Object.values(nextSeasonA.clubs).filter((c) => c.competitionId === "championship");
  assert(s2SlClubsA.length === 14, `Super League maintains exactly 14 clubs (has ${s2SlClubsA.length})`);
  assert(s2ChampClubsA.length === 14, `Championship maintains exactly 14 clubs (has ${s2ChampClubsA.length})`);
  assert(validateSquadInvariants(nextSeasonA).valid, "Squad invariants valid under Scenario A");

  // ----------------------------------------------------
  // TEST SCENARIO B: Super League Team Wins The Million Pound Game (Survives)
  // ----------------------------------------------------
  console.log("\n--- 6. Scenario B: Super League Club Wins The Million Pound Game (Survives) ---");
  const stateScenarioB = JSON.parse(JSON.stringify(state));

  const mpgIndexB = stateScenarioB.competitions["super-league"].fixtures.findIndex(
    (f: any) => f.roundName === "The Million Pound Game"
  );
  stateScenarioB.competitions["super-league"].fixtures[mpgIndexB] = {
    ...stateScenarioB.competitions["super-league"].fixtures[mpgIndexB],
    isPlayed: true,
    homeScore: 28,
    awayScore: 16,
  };

  const awardsB = calculateSeasonAwards(stateScenarioB);
  assert(awardsB.millionPoundGame?.superLeagueSurvived === true, "Super League club survived in Super League");
  assert(awardsB.promotedClubIds.length === 1, "Exactly 1 club promoted");
  assert(awardsB.relegatedClubIds.length === 1, "Exactly 1 club relegated");
  assert(awardsB.promotedClubIds.includes(autoPromotedChamp), "1st Champ auto-promoted");
  assert(awardsB.relegatedClubIds.includes(autoRelegatedSL), "14th SL auto-relegated");

  const rolloverB = rolloverSeason(stateScenarioB);
  const nextSeasonB = rolloverB.state;

  assert(nextSeasonB.clubs[mpgSL13].competitionId === "super-league", "13th SL club survived in Super League");
  assert(nextSeasonB.clubs[champPlayoffWinner].competitionId === "championship", "Championship Playoff Winner remained in Championship");
  assert(nextSeasonB.clubs[autoPromotedChamp].competitionId === "super-league", "1st Champ promoted to Super League");
  assert(nextSeasonB.clubs[autoRelegatedSL].competitionId === "championship", "14th SL relegated to Championship");

  const s2SlClubsB = Object.values(nextSeasonB.clubs).filter((c) => c.competitionId === "super-league");
  const s2ChampClubsB = Object.values(nextSeasonB.clubs).filter((c) => c.competitionId === "championship");
  assert(s2SlClubsB.length === 14, `Super League maintains exactly 14 clubs (has ${s2SlClubsB.length})`);
  assert(s2ChampClubsB.length === 14, `Championship maintains exactly 14 clubs (has ${s2ChampClubsB.length})`);
  assert(validateSquadInvariants(nextSeasonB).valid, "Squad invariants valid under Scenario B");

  console.log("\n========================================================");
  console.log(`ALL MILLION POUND GAME TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

runMillionPoundGameTests().catch((err) => {
  console.error("FATAL ERROR IN MPG TEST:", err);
  process.exit(1);
});
