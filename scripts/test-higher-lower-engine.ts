/**
 * Higher or Lower engine tests.
 * Run: npx tsx scripts/test-higher-lower-engine.ts
 */
import {
  answerHigherLower,
  applyHigherLowerResult,
  createEmptyHigherLowerStats,
  createHigherLowerRun,
  higherPlayer,
  pickHigherLowerPair,
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
  return {
    id,
    identityId: id.replace(/-\d{4}$/, ""),
    displayName: id
      .split("-")
      .filter((part) => !/^\d{4}$/.test(part))
      .map((part) => part[0]!.toUpperCase() + part.slice(1))
      .join(" "),
    club: "Leeds Rhinos",
    position: "LOOSE_FORWARD",
    positionLabel: "Loose Forward",
    nationality: "England",
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
];

console.log("Higher or Lower engine");

for (let round = 0; round < 12; round++) {
  const pair = pickHigherLowerPair("seed-a", round, pool);
  assert(pair.left.rating !== pair.right.rating, `round ${round} ratings differ`);
  assert(
    pair.left.identityId !== pair.right.identityId,
    `round ${round} uses two people`
  );
  if (round <= 2) {
    assert(
      Math.abs(pair.left.rating - pair.right.rating) >= 12,
      `early round ${round} uses a wide gap`
    );
  }
}

const close = pickHigherLowerPair("seed-b", 10, pool);
assert(
  Math.abs(close.left.rating - close.right.rating) <= 4,
  "late rounds use a close gap when possible"
);

const run = createHigherLowerRun("seed-c", pool);
const pair = {
  left: pool.find((item) => item.id === run.leftId)!,
  right: pool.find((item) => item.id === run.rightId)!,
};
const winner = higherPlayer(pair);
assert(winner !== "tie", "created pair is never a tie");
const answered = answerHigherLower(run, winner, pool);
assert(answered.correct, "picking the higher player is correct");

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
