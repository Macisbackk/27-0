/**
 * Higher or Lower engine tests.
 * Run: npx tsx scripts/test-higher-lower-engine.ts
 */
import {
  answerHigherLower,
  applyHigherLowerResult,
  createEmptyHigherLowerStats,
  createHigherLowerRun,
  HIGHER_LOWER_HISTORY_SIZE,
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
assert(
  run.historyIds.length === HIGHER_LOWER_HISTORY_SIZE,
  "starts with five history cards"
);
const board = resolveHigherLowerPlayers(run, pool)!;
assert(Boolean(board.base && board.challenge), "base and challenge resolve");
assert(
  board.base.identityId !== board.challenge.identityId,
  "challenge is a different player"
);
assert(board.base.rating !== board.challenge.rating, "ratings differ");

const choice =
  board.challenge.rating > board.base.rating ? "higher" : "lower";
const answered = answerHigherLower(run, choice, pool);
assert(answered.correct, "correct HIGHER/LOWER wins the round");
assert(answered.run.revealed, "rating is revealed after the guess");

const wrong = answerHigherLower(
  createHigherLowerRun(pool, "seed-d"),
  choice === "higher" ? "lower" : "higher",
  pool
);
assert(!wrong.correct, "wrong HIGHER/LOWER fails");
assert(wrong.run.status === "lost", "wrong guess ends the run");

const stats = applyHigherLowerResult(createEmptyHigherLowerStats(), true);
const ten = Array.from({ length: 9 }, () => true).reduce(
  (current) => applyHigherLowerResult(current, true),
  stats
);
assert(ten.currentStreak === 10, "streak reaches 10");
const reset = applyHigherLowerResult(ten, false);
assert(reset.currentStreak === 0, "a miss resets the streak");
assert(reset.bestStreak === 10, "best streak is kept");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
