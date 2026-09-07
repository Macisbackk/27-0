/**
 * Regulation draw / golden-point smoke test.
 * Run: npx tsx scripts/test-match-draws.ts
 *
 * Verifies:
 *  - League fixtures with allowDraw:true can finish level.
 *  - Quick Mode (no allowDraw) NEVER draws — winner forced.
 *  - Knockout-style fixtures (cupMode) NEVER finish level.
 *  - pickScorePairAllowingDraw produces roughly the requested draw rate.
 */
import { simulateOneFixture, simulateSeason } from "../src/lib/game/season-simulation";
import { pickScorePairAllowingDraw } from "../src/lib/game/rl-scores";
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
        userRatingOverride: 75 + (i % 5) - 2,
        opponentRatingOverride: 75,
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

console.log("\nQuick Mode style (simulateOneFixture, no allowDraw)");
{
  const { draws, wins, losses } = runFixtureBatch(false, false, "friendly");
  console.log(`  W:${wins} D:${draws} L:${losses}`);
  assert(draws === 0, "Quick Mode never finishes as draws");
  assert(wins + losses === N, "every fixture produces a decisive W or L");
}

console.log("\nKnockout (simulateOneFixture, cupMode: true, no allowDraw)");
{
  const { draws, wins, losses } = runFixtureBatch(false, true, "cup");
  console.log(`  W:${wins} D:${draws} L:${losses}`);
  assert(draws === 0, "no regulation draws — a winner is always forced");
  assert(wins + losses === N, "every tie produces a decisive W or L");
}

console.log("\nQuick Mode simulateSeason (default allowDraw false)");
{
  let anyDraw = false;
  for (let i = 0; i < 20; i++) {
    const season = simulateSeason([], `quick-no-draw-${i}`, {
      currentSeasonOnly: true,
    });
    if ((season.draws ?? 0) > 0) anyDraw = true;
    if (season.fixtures.some((f) => f.result === "D")) anyDraw = true;
    if (season.fixtures.some((f) => f.pointsFor === f.pointsAgainst)) {
      anyDraw = true;
    }
  }
  assert(!anyDraw, "Quick Mode seasons never produce draws or level scores");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
