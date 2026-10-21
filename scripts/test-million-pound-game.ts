/**
 * Dedicated End-to-End Test for The Million Pound Game & Promotion/Relegation
 *
 * Verifies:
 * 1. Automatic promotion of 1st placed Championship club.
 * 2. Automatic relegation of 14th placed Super League club.
 * 3. Championship Top 6 Playoffs (2nd-6th) leading to Playoff Final Winner.
 * 4. The Million Pound Game scheduled for Week 33 between 13th SL & Championship Playoff Winner.
 * 5. Case A: Championship team wins MPG -> 2 promoted, 2 relegated, club counts preserved (14 SL, 14 Champ).
 * 6. Case B: Super League team wins MPG -> 1 promoted, 1 relegated, 13th SL survives, club counts preserved.
 */

import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import { rolloverSeason, calculateSeasonAwards } from "../src/lib/manager/rollover";
import { sortStandings } from "../src/lib/manager/competitions";
import { validateSquadInvariants } from "../src/lib/manager/squad";
import { SEASON_WEEKS } from "../src/lib/manager/rules";

const W = SEASON_WEEKS;

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

  // Advance to week 29 (end of regular season)
  console.log(`--- 1. Simulating Regular Season up to Week ${W.LAST_LEAGUE_ROUND} ---`);
  while (state.calendar.currentWeek <= W.LAST_LEAGUE_ROUND) {
    state = advanceWeek(state);
  }

  assert(state.calendar.currentWeek === W.PLAYOFF_ELIMINATORS, `Advanced to Week ${W.PLAYOFF_ELIMINATORS} (Playoff Eliminators)`);
  assert(state.calendar.phase === "playoffs", "Calendar phase transitioned to playoffs");

  const slStandings = sortStandings(state.competitions["super-league"].standings);
  const champStandings = sortStandings(state.competitions["championship"].standings);

  const autoPromotedChamp = champStandings[0].clubId;
  const autoRelegatedSL = slStandings[13].clubId;
  const mpgSL13 = slStandings[12].clubId;

  console.log(`  ▲ 1st Championship (Auto Promoted): ${state.clubs[autoPromotedChamp]?.name}`);
  console.log(`  ▼ 14th Super League (Auto Relegated): ${state.clubs[autoRelegatedSL]?.name}`);
  console.log(`  ⚔️ 13th Super League (MPG Participant): ${state.clubs[mpgSL13]?.name}`);

  // Check week 30 fixtures scheduled
  const slW29Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === W.PLAYOFF_ELIMINATORS);
  const champW29Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === W.PLAYOFF_ELIMINATORS);

  assert(slW29Fixtures.length === 2, `Super League has 2 Eliminator fixtures at Week ${W.PLAYOFF_ELIMINATORS}`);
  assert(champW29Fixtures.length === 2, `Championship has 2 Eliminator fixtures at Week ${W.PLAYOFF_ELIMINATORS}`);

  // Advance Week 30 (Eliminators played)
  console.log(`\n--- 2. Simulating Week ${W.PLAYOFF_ELIMINATORS} Eliminators ---`);
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === W.PLAYOFF_SEMI_FINALS, `Advanced to Week ${W.PLAYOFF_SEMI_FINALS} (Semi-Finals)`);

  // Check week 31 Semi-Finals scheduled
  const slW30Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === W.PLAYOFF_SEMI_FINALS);
  const champW30Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === W.PLAYOFF_SEMI_FINALS);
  assert(slW30Fixtures.length === 2, `Super League has 2 Semi-Final fixtures at Week ${W.PLAYOFF_SEMI_FINALS}`);
  assert(champW30Fixtures.length === 1, "Championship has exactly 1 Semi-Final (2nd vs lower elim; higher elim bye to Final)");
  assert(
    champW30Fixtures[0].homeClubId !== champW30Fixtures[0].awayClubId,
    "Championship Semi-Final is never a club vs itself"
  );

  // Advance Week 31 (Semi-Finals played)
  console.log(`\n--- 3. Simulating Week ${W.PLAYOFF_SEMI_FINALS} Semi-Finals ---`);
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === W.PLAYOFF_FINALS, `Advanced to Week ${W.PLAYOFF_FINALS} (Finals)`);

  // Check week 32 Finals scheduled
  const slW31Fixtures = state.competitions["super-league"].fixtures.filter((f) => f.week === W.PLAYOFF_FINALS);
  const champW31Fixtures = state.competitions["championship"].fixtures.filter((f) => f.week === W.PLAYOFF_FINALS);
  assert(slW31Fixtures.length === 1, `Super League has Grand Final fixture at Week ${W.PLAYOFF_FINALS}`);
  assert(champW31Fixtures.length === 1, `Championship has Playoff Final fixture at Week ${W.PLAYOFF_FINALS}`);

  // Advance Week 32 (Finals played)
  console.log(`\n--- 4. Simulating Week ${W.PLAYOFF_FINALS} Finals & Scheduling The Million Pound Game ---`);
  state = advanceWeek(state);
  assert(state.calendar.currentWeek === W.MILLION_POUND_GAME, `Advanced to Week ${W.MILLION_POUND_GAME} (The Million Pound Game)`);

  // Verify The Million Pound Game is scheduled in Week 33
  const mpgFixture = state.competitions["super-league"].fixtures.find(
    (f) => f.week === W.MILLION_POUND_GAME && f.roundName === "The Million Pound Game"
  );
  assert(!!mpgFixture, `The Million Pound Game fixture exists at Week ${W.MILLION_POUND_GAME}`);
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

  // ----------------------------------------------------
  // TEST SCENARIO C: Natural Simulation via advanceWeek (Score Parity & Honours Check)
  // ----------------------------------------------------
  console.log("\n--- 7. Scenario C: Natural Simulation via advanceWeek (Score Parity & Honours) ---");
  // state is currently at Week 33 with unplayed MPG fixtures in both SL and Championship
  const simulatedState = advanceWeek(state);
  assert(simulatedState.calendar.currentWeek === W.POST_SEASON, `Advanced to Week ${W.POST_SEASON}`);
  assert(simulatedState.calendar.phase === "season_end", "Phase transitioned to season_end");

  const slMpgPlayed = simulatedState.competitions["super-league"].fixtures.find(
    (f) => f.roundName === "The Million Pound Game" && f.week === W.MILLION_POUND_GAME
  );
  const champMpgPlayed = simulatedState.competitions["championship"].fixtures.find(
    (f) => f.roundName === "The Million Pound Game" && f.week === W.MILLION_POUND_GAME
  );

  assert(!!slMpgPlayed && slMpgPlayed.isPlayed, "Super League MPG fixture is played");
  assert(!!champMpgPlayed && champMpgPlayed.isPlayed, "Championship MPG fixture is played");
  assert(slMpgPlayed!.homeScore === champMpgPlayed!.homeScore, `SL home score (${slMpgPlayed!.homeScore}) matches Championship home score (${champMpgPlayed!.homeScore})`);
  assert(slMpgPlayed!.awayScore === champMpgPlayed!.awayScore, `SL away score (${slMpgPlayed!.awayScore}) matches Championship away score (${champMpgPlayed!.awayScore})`);

  const awardsC = calculateSeasonAwards(simulatedState);
  assert(awardsC.millionPoundGame !== null, "Honours include Million Pound Game");
  assert(
    awardsC.millionPoundGame!.score === `${slMpgPlayed!.homeScore} - ${slMpgPlayed!.awayScore}`,
    `Honours score (${awardsC.millionPoundGame!.score}) exactly matches match engine score (${slMpgPlayed!.homeScore} - ${slMpgPlayed!.awayScore})`
  );
  const expectedWinner =
    slMpgPlayed!.homeScore! >= slMpgPlayed!.awayScore!
      ? simulatedState.clubs[slMpgPlayed!.homeClubId].name
      : simulatedState.clubs[slMpgPlayed!.awayClubId].name;
  assert(
    awardsC.millionPoundGame!.winner === expectedWinner,
    `Honours winner (${awardsC.millionPoundGame!.winner}) matches match winner (${expectedWinner})`
  );

  // ----------------------------------------------------
  // TEST SCENARIO D: Equal-score MPG — SL survives (aligned awards + bulletin rule)
  // ----------------------------------------------------
  console.log("\n--- 8. Scenario D: Equal-score MPG draw awards SL survival ---");
  const stateScenarioD = JSON.parse(JSON.stringify(state));
  const mpgIndexD = stateScenarioD.competitions["super-league"].fixtures.findIndex(
    (f: any) => f.roundName === "The Million Pound Game"
  );
  stateScenarioD.competitions["super-league"].fixtures[mpgIndexD] = {
    ...stateScenarioD.competitions["super-league"].fixtures[mpgIndexD],
    isPlayed: true,
    homeScore: 18,
    awayScore: 18,
  };
  // Mirror Champ copy too
  const champMpgIndexD = stateScenarioD.competitions["championship"].fixtures.findIndex(
    (f: any) => f.roundName === "The Million Pound Game"
  );
  if (champMpgIndexD >= 0) {
    stateScenarioD.competitions["championship"].fixtures[champMpgIndexD] = {
      ...stateScenarioD.competitions["championship"].fixtures[champMpgIndexD],
      isPlayed: true,
      homeScore: 18,
      awayScore: 18,
    };
  }

  const awardsD = calculateSeasonAwards(stateScenarioD);
  assert(awardsD.millionPoundGame?.superLeagueSurvived === true, "Equal score: Super League survives via >= rule");
  assert(awardsD.promotedClubIds.length === 1, "Equal score: exactly 1 club promoted");
  assert(awardsD.relegatedClubIds.length === 1, "Equal score: exactly 1 club relegated");
  assert(!awardsD.promotedClubIds.includes(champPlayoffWinner), "Equal score: Champ playoff winner NOT promoted");
  assert(!awardsD.relegatedClubIds.includes(mpgSL13), "Equal score: 13th SL NOT relegated");

  const rolloverC = rolloverSeason(simulatedState);
  assert(
    rolloverC.awards.millionPoundGame!.score === `${slMpgPlayed!.homeScore} - ${slMpgPlayed!.awayScore}`,
    "Rollover awards preserve exact Million Pound Game score"
  );
  assert(
    rolloverC.state.seasonHistory![0].millionPoundGame!.score === `${slMpgPlayed!.homeScore} - ${slMpgPlayed!.awayScore}`,
    "Archived season history record preserves exact Million Pound Game score"
  );

  console.log("\n========================================================");
  console.log(`ALL MILLION POUND GAME TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

runMillionPoundGameTests().catch((err) => {
  console.error("FATAL ERROR IN MPG TEST:", err);
  process.exit(1);
});
