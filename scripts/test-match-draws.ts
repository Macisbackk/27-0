/**
 * Regulation draw support smoke test.
 * Run: npx tsx scripts/test-match-draws.ts
 *
 * Verifies:
 *  - League / friendly (season-simulation simulateOneFixture with allowDraw:true)
 *    can finish level — draws show up at a reasonable rate and are never
 *    forced to a winner.
 *  - Championship league fixtures (simulateChampionshipFixtureScores) can draw.
 *  - Reserve fixtures (simulateReserveFixture) can draw.
 *  - Challenge Cup / play-offs (simulateOneFixture without allowDraw, cupMode)
 *    NEVER finish level — a winner is always forced.
 *  - pickScorePairAllowingDraw produces roughly the requested draw rate.
 */
import { simulateOneFixture } from "../src/lib/game/season-simulation";
import { pickScorePairAllowingDraw } from "../src/lib/game/rl-scores";
import { simulateChampionshipFixtureScores } from "../src/lib/manager/championship/championshipLeague";
import { simulateReserveFixture } from "../src/lib/manager/managerReserves";
import { createNewCareer } from "../src/lib/manager/managerState";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import { CHAMPIONSHIP_CLUB_NAMES } from "../src/lib/clubs/championship-clubs";
import seedrandom from "seedrandom";

const N = 2000;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.error(`  \u2717 ${message}`);
  }
}

console.log(`Regulation draw support — ${N} iterations per scenario\n`);

// ---------------------------------------------------------------------------
// 1. pickScorePairAllowingDraw — raw draw rate check.
// ---------------------------------------------------------------------------
console.log("pickScorePairAllowingDraw");
{
  const rng = seedrandom("draw-pair-check");
  let draws = 0;
  let allDrawsLevel = true;
  for (let i = 0; i < N; i++) {
    const pair = pickScorePairAllowingDraw(16, 40, 0, 24, rng);
    if (pair.isDraw) {
      draws++;
      if (pair.winner !== pair.loser) allDrawsLevel = false;
    }
  }
  const rate = draws / N;
  console.log(`  draws: ${draws}/${N} (${(rate * 100).toFixed(1)}%)`);
  assert(rate > 0.05 && rate < 0.16, "draw rate is roughly ~10% (5%-16% band)");
  assert(allDrawsLevel, "isDraw always implies winner === loser score");
}

// ---------------------------------------------------------------------------
// 2. League / friendly fixtures via simulateOneFixture(allowDraw:true).
// ---------------------------------------------------------------------------
function runFixtureBatch(allowDraw: boolean, cupMode: boolean, label: string) {
  let draws = 0;
  let wins = 0;
  let losses = 0;
  let neverEqualScoreWithForcedWinner = true;

  for (let i = 0; i < N; i++) {
    const { fixture } = simulateOneFixture(
      [],
      "Test Opponent",
      i % 2 === 0,
      i + 1,
      "draw-test-seed",
      { form: 0, seasonDropGoals: 0 },
      {
        userRatingOverride: 75 + (i % 5) - 2, // keep gap small — close matches
        opponentRatingOverride: 75,
        managerCareerMode: true,
        matchKey: `${label}-fixture-${i}`,
        cupMode,
        ...(allowDraw ? { allowDraw: true } : {}),
      }
    );

    if (fixture.result === "D") {
      draws++;
      if (fixture.pointsFor !== fixture.pointsAgainst) {
        neverEqualScoreWithForcedWinner = false;
      }
    } else if (fixture.result === "W") {
      wins++;
      if (fixture.pointsFor === fixture.pointsAgainst) {
        neverEqualScoreWithForcedWinner = false;
      }
    } else {
      losses++;
      if (fixture.pointsFor === fixture.pointsAgainst) {
        neverEqualScoreWithForcedWinner = false;
      }
    }
  }

  return { draws, wins, losses, neverEqualScoreWithForcedWinner };
}

console.log("\nLeague (simulateOneFixture, allowDraw: true)");
{
  const { draws, wins, losses, neverEqualScoreWithForcedWinner } =
    runFixtureBatch(true, false, "league");
  console.log(
    `  W:${wins} D:${draws} L:${losses} (draw rate ${((draws / N) * 100).toFixed(1)}%)`
  );
  assert(draws > 0, "at least one regulation draw occurs across the sample");
  assert(
    neverEqualScoreWithForcedWinner,
    "result label (W/D/L) always matches whether the score is level"
  );
}

console.log("\nFriendly (simulateOneFixture, allowDraw: true)");
{
  // Friendlies route through the same simulateOneFixture allowDraw path —
  // Manager wires allowDraw via getMatchResolutionRules for competition "friendly".
  const { draws, wins, losses, neverEqualScoreWithForcedWinner } =
    runFixtureBatch(true, false, "friendly");
  console.log(
    `  W:${wins} D:${draws} L:${losses} (draw rate ${((draws / N) * 100).toFixed(1)}%)`
  );
  assert(draws > 0, "at least one regulation draw occurs across the sample");
  assert(
    neverEqualScoreWithForcedWinner,
    "result label (W/D/L) always matches whether the score is level"
  );
}

// ---------------------------------------------------------------------------
// 3. Knockouts (Challenge Cup / play-offs) — allowDraw omitted, must never draw.
// ---------------------------------------------------------------------------
console.log("\nChallenge Cup (simulateOneFixture, cupMode: true, no allowDraw)");
{
  const { draws, wins, losses } = runFixtureBatch(false, true, "cup");
  console.log(`  W:${wins} D:${draws} L:${losses}`);
  assert(draws === 0, "no regulation draws — a winner is always forced");
  assert(wins + losses === N, "every tie produces a decisive W or L");
}

console.log("\nPlay-offs (simulateOneFixture, no allowDraw)");
{
  const { draws, wins, losses } = runFixtureBatch(false, false, "playoffs");
  console.log(`  W:${wins} D:${draws} L:${losses}`);
  assert(draws === 0, "no regulation draws — a winner is always forced");
  assert(wins + losses === N, "every tie produces a decisive W or L");
}

// ---------------------------------------------------------------------------
// 4. Championship league (simulateChampionshipFixtureScores).
// ---------------------------------------------------------------------------
console.log("\nChampionship league (simulateChampionshipFixtureScores)");
{
  const clubs = CHAMPIONSHIP_CLUB_NAMES;
  let draws = 0;
  let decisive = 0;
  for (let i = 0; i < N; i++) {
    const home = clubs[i % clubs.length]!;
    const away = clubs[(i + 1) % clubs.length]!;
    const score = simulateChampionshipFixtureScores(
      home,
      away,
      "champ-draw-test",
      `fixture-${i}`
    );
    if (score.homeScore === score.awayScore) draws++;
    else decisive++;
  }
  console.log(
    `  draws: ${draws}/${N} (${((draws / N) * 100).toFixed(1)}%), decisive: ${decisive}`
  );
  assert(draws > 0, "championship fixtures can finish level");
  assert(decisive > 0, "championship fixtures can still produce a winner");
}

// ---------------------------------------------------------------------------
// 5. Reserve fixtures (simulateReserveFixture).
// ---------------------------------------------------------------------------
console.log("\nReserve fixtures (simulateReserveFixture)");
{
  let career = createNewCareer(CURRENT_PLAYABLE_CLUBS[0]!);
  const opponent = CURRENT_PLAYABLE_CLUBS[1]!;
  let draws = 0;
  let wins = 0;
  let losses = 0;
  let drawFlagMismatch = 0;

  for (let round = 1; round <= N; round++) {
    career = { ...career, seed: `reserve-draw-test-${round}` };
    const result = simulateReserveFixture(career, round, opponent);
    if (result.walkover) continue; // shouldn't happen — squads are full-strength
    const scoreIsLevel = result.userScore === result.oppScore;
    if (scoreIsLevel) draws++;
    else if (result.userWon) wins++;
    else losses++;

    if (scoreIsLevel !== Boolean(result.isDraw)) drawFlagMismatch++;
    if (scoreIsLevel && result.userWon) drawFlagMismatch++;
  }

  console.log(
    `  W:${wins} D:${draws} L:${losses} (draw rate ${((draws / N) * 100).toFixed(1)}%)`
  );
  assert(draws > 0, "reserve fixtures can finish level");
  assert(
    drawFlagMismatch === 0,
    "isDraw flag and userWon always agree with the score"
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
