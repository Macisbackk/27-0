/**
 * Wordle engine tests.
 * Run: npx tsx scripts/test-wordle-engine.ts
 */
import {
  buildWordleClues,
  createEmptyWordleStats,
  createWordleRun,
  isSameWordlePlayer,
  pickDailyWordlePlayer,
  recordWordleResult,
  submitWordleGuess,
  WORDLE_MAX_GUESSES,
} from "../src/lib/mini-games/wordle/engine";
import { resolvePlayerGuess, type MiniGamePlayer } from "../src/lib/mini-games/players";

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
  partial: Partial<MiniGamePlayer> & Pick<MiniGamePlayer, "id" | "displayName">
): MiniGamePlayer {
  return {
    identityId: partial.identityId ?? partial.id,
    club: "Leeds Rhinos",
    position: "STAND_OFF",
    positionLabel: "Stand Off",
    nationality: "England",
    rating: 90,
    year: 2009,
    isHistoric: true,
    ...partial,
  };
}

const pool: MiniGamePlayer[] = [
  player({
    id: "kevin-sinfield-2009",
    identityId: "kevin-sinfield",
    displayName: "Kevin Sinfield",
    rating: 94,
    year: 2009,
  }),
  player({
    id: "rob-burrow-2007",
    identityId: "rob-burrow",
    displayName: "Rob Burrow",
    club: "Leeds Rhinos",
    position: "SCRUM_HALF",
    positionLabel: "Scrum Half",
    nationality: "England",
    rating: 91,
    year: 2007,
  }),
  player({
    id: "mike-cooper",
    identityId: "michael-cooper",
    displayName: "Michael Cooper",
    club: "Warrington Wolves",
    position: "PROP",
    positionLabel: "Prop",
    nationality: "England",
    rating: 82,
    year: 2026,
    isHistoric: false,
  }),
  player({
    id: "sam-tomkins-2012",
    identityId: "sam-tomkins",
    displayName: "Sam Tomkins",
    club: "Wigan Warriors",
    position: "FULLBACK",
    positionLabel: "Fullback",
    nationality: "England",
    rating: 93,
    year: 2012,
  }),
];

console.log("Wordle engine");

const a = pickDailyWordlePlayer("2026-09-08", pool);
const b = pickDailyWordlePlayer("2026-09-08", pool);
const c = pickDailyWordlePlayer("2026-09-09", pool);
assert(a.id === b.id, "same date returns the same daily player");
assert(WORDLE_MAX_GUESSES === 6, "six guesses");

const clues = buildWordleClues(pool[1]!, pool[0]!);
assert(clues.club === "match", "same club is a match");
assert(clues.position === "miss", "different position is a miss");
assert(clues.rating === "higher", "lower guess rating points higher");
assert(clues.year === "higher", "earlier year points higher");

assert(
  isSameWordlePlayer(pool[0]!, player({
    id: "kevin-sinfield-2012",
    identityId: "kevin-sinfield",
    displayName: "Kevin Sinfield",
  })),
  "identity match counts as the same player"
);

assert(
  resolvePlayerGuess("mike cooper", pool)?.id === "mike-cooper",
  "Mike resolves to Michael Cooper"
);
assert(
  resolvePlayerGuess("Kevin Sinfield", pool)?.identityId === "kevin-sinfield",
  "full name resolves"
);

let run = createWordleRun("2026-09-08", pool);
assert(run.status === "playing", "new run is in progress");
const extras: MiniGamePlayer[] = Array.from({ length: 6 }, (_, i) =>
  player({
    id: `decoy-${i}`,
    identityId: `decoy-${i}`,
    displayName: `Decoy ${i}`,
    club: "Wigan Warriors",
    position: "WING",
    positionLabel: "Wing",
    nationality: "Australia",
    rating: 70 + i,
    year: 2000 + i,
  })
);
const losePool = [...pool, ...extras];
for (const decoy of extras) {
  const next = submitWordleGuess(run, decoy.id, losePool);
  run = next.run;
}
assert(run.status === "lost", "six wrong guesses lose the day");

const winRun = createWordleRun("2026-09-10", pool);
const won = submitWordleGuess(winRun, winRun.answerId, pool);
assert(won.run.status === "won", "correct player wins");

const stats = recordWordleResult(createEmptyWordleStats(), won.run);
assert(stats.wins === 1 && stats.currentStreak === 1, "win updates streak");
const again = recordWordleResult(stats, won.run);
assert(again.played === stats.played, "same day is not counted twice");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
