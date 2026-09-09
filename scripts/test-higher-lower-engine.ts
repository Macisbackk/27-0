/**
 * Higher or Lower engine tests.
 * Run: npx tsx scripts/test-higher-lower-engine.ts
 */
import {
  advanceHigherLower,
  answerHigherLower,
  applyHigherLowerPick,
  applyHigherLowerRunEnd,
  createEmptyHigherLowerStats,
  createHigherLowerRun,
  HIGHER_LOWER_PICKS,
  higherLowerPickNumber,
  isFinalHigherLowerPick,
  resolveHigherLowerPlayers,
} from "../src/lib/mini-games/higher-lower/engine";
import type { MiniGamePlayer } from "../src/lib/mini-games/players";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${message}`);
  } else {
    failed += 1;
    console.error(`  \u2717 ${message}`);
  }
}

function player(
  id: string,
  rating: number,
  year: number,
  historic = true
): MiniGamePlayer {
  const displayName = id
    .split("-")
    .filter((part) => !/^\d{4}$/.test(part))
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id,
    identityId: id.replace(/-\d{4}$/, ""),
    displayName,
    club: "Leeds Rhinos",
    clubId: "leeds",
    position: "LOOSE_FORWARD",
    positionLabel: "Loose Forward",
    nationality: "England",
    nationalityKey: "england",
    rating,
    age: Math.max(18, year - 1990),
    year,
    isHistoric: historic,
  };
}

const pool: MiniGamePlayer[] = [
  player("alpha-2009", 96, 2009),
  player("bravo-2026", 70, 2026, false),
  player("charlie-2012", 88, 2012),
  player("delta-2015", 87, 2015),
  player("echo-2018", 75, 2018),
  player("foxtrot-2020", 74, 2020),
  player("golf-2005", 94, 2005),
  player("hotel-2026", 71, 2026, false),
  player("india-2011", 83, 2011),
  player("juliet-2016", 80, 2016),
];

console.log("Higher or Lower engine");

const run = createHigherLowerRun(pool, "seed-c");
assert(run.pickIndex === 0, "starts on pick 0");
assert(higherLowerPickNumber(run) === 1, "displays as PICK 1 / 5");
assert(!Array.isArray((run as { historyIds?: unknown }).historyIds), "no five-card history");
const board = resolveHigherLowerPlayers(run, pool)!;
assert(Boolean(board.base && board.challenge), "base and challenge resolve");
assert(
  board.base.identityId !== board.challenge.identityId,
  "challenge is a different player"
);
assert(board.base.rating !== board.challenge.rating, "ratings differ");
assert(!run.revealed, "ratings stay hidden before the guess");

const choice =
  board.challenge.rating > board.base.rating ? "higher" : "lower";
const answered = answerHigherLower(run, choice, pool);
assert(answered.correct, "correct HIGHER/LOWER wins the pick");
assert(answered.run.revealed, "rating is revealed after the guess");
assert(answered.run.status === "playing", "correct pick 1 does not end the run");
assert(answered.run.pickIndex === 0, "pick index waits until advance");

const skipped = advanceHigherLower(answered.run, pool);
assert(skipped.pickIndex === 1, "advance moves to pick 2");
assert(higherLowerPickNumber(skipped) === 2, "displays as PICK 2 / 5");
assert(!skipped.revealed, "next pick hides ratings again");
assert(skipped.baseId === answered.run.challengeId, "challenge becomes current player");
assert(skipped.challengeId !== skipped.baseId, "a new challenge appears");

const sixth = advanceHigherLower(
  {
    ...skipped,
    pickIndex: 4,
    revealed: true,
    lastCorrect: true,
    status: "playing",
  },
  pool
);
assert(sixth.pickIndex === 4, "advance refuses a sixth pick");

let playing = createHigherLowerRun(pool, "seed-perfect");
for (let pick = 0; pick < HIGHER_LOWER_PICKS; pick++) {
  const resolved = resolveHigherLowerPlayers(playing, pool)!;
  const nextChoice =
    resolved.challenge.rating > resolved.base.rating ? "higher" : "lower";
  const result = answerHigherLower(playing, nextChoice, pool);
  assert(result.correct, `perfect run pick ${pick + 1} is correct`);
  if (pick < HIGHER_LOWER_PICKS - 1) {
    assert(result.run.status === "playing", `pick ${pick + 1} continues`);
    playing = advanceHigherLower(result.run, pool);
    assert(playing.pickIndex === pick + 1, `now on pick ${pick + 2}`);
  } else {
    assert(result.run.status === "won", "pick 5 / 5 wins the run");
    assert(isFinalHigherLowerPick(result.run), "pick 5 is the final pick");
    const noSixth = advanceHigherLower(result.run, pool);
    assert(noSixth.pickIndex === 4, "winning pick 5 does not create pick 6");
    assert(noSixth.status === "won", "status stays won");
  }
}

const losing = createHigherLowerRun(pool, "seed-d");
const losingBoard = resolveHigherLowerPlayers(losing, pool)!;
const wrongChoice =
  losingBoard.challenge.rating > losingBoard.base.rating ? "lower" : "higher";
const wrong = answerHigherLower(losing, wrongChoice, pool);
assert(!wrong.correct, "wrong HIGHER/LOWER fails");
assert(wrong.run.status === "lost", "wrong guess ends the run");
const afterLoss = advanceHigherLower(wrong.run, pool);
assert(afterLoss.status === "lost", "a lost run cannot continue");
assert(afterLoss.pickIndex === wrong.run.pickIndex, "loss does not spawn another pick");

const afterPick = applyHigherLowerPick(createEmptyHigherLowerStats(), true);
assert(afterPick.correct === 1, "a correct pick increments pick count");
assert(afterPick.plays === 0, "a pick does not count as a completed run");
const won = applyHigherLowerRunEnd(afterPick, true);
assert(won.plays === 1, "a completed run increments plays");
assert(won.fivePickWins === 1, "a perfect run counts as a five-pick win");
assert(won.currentStreak === 1, "five-pick streak starts at 1");
const lost = applyHigherLowerRunEnd(won, false);
assert(lost.currentStreak === 0, "a failed run resets the five-pick streak");
assert(lost.failedRuns === 1, "failed runs are counted");
assert(lost.bestStreak === 1, "best five-pick streak is kept");
assert(lost.fivePickWins === 1, "a loss does not remove five-pick wins");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
