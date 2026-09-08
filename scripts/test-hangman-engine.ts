/**
 * Hangman engine tests.
 * Run: npx tsx scripts/test-hangman-engine.ts
 */
import {
  createHangmanRun,
  guessHangmanLetter,
  isHangmanPunctuation,
  remainingHangmanLives,
  wrongGuessCount,
  HANGMAN_MAX_WRONG,
} from "../src/lib/mini-games/hangman/engine";
import { pickHangmanPuzzle } from "../src/lib/mini-games/hangman/answers";
import type { HangmanPuzzle, HangmanRun } from "../src/lib/mini-games/hangman/types";

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

const puzzle: HangmanPuzzle = {
  id: "test-st-helens",
  category: "club",
  answer: "St Helens",
  hint: "A Super League club",
};

function runFrom(answer: string): HangmanRun {
  return {
    id: "test",
    date: "2026-09-08",
    daily: true,
    puzzleId: "test",
    category: "club",
    answer,
    hint: "test",
    guessed: [],
    status: "playing",
    rewardClaimed: false,
  };
}

console.log("Hangman engine");
assert(HANGMAN_MAX_WRONG === 8, "eight wrong guesses");
assert(isHangmanPunctuation(" "), "spaces are revealed");
assert(isHangmanPunctuation("-"), "hyphens are revealed");
assert(isHangmanPunctuation("'"), "apostrophes are revealed");
assert(!isHangmanPunctuation("S"), "letters must be guessed");

const bank = [puzzle, { ...puzzle, id: "other", answer: "Wigan Warriors" }];
const dailyA = pickHangmanPuzzle("hangman-daily:2026-09-08", bank);
const dailyB = pickHangmanPuzzle("hangman-daily:2026-09-08", bank);
assert(dailyA.id === dailyB.id, "daily seed is deterministic");

let run = runFrom("St Helens");
const firstS = guessHangmanLetter(run, "s");
run = firstS.run;
assert(firstS.accepted, "first S is accepted");
const dup = guessHangmanLetter(run, "S");
assert(!dup.accepted, "duplicate letters are ignored");
assert(dup.run.guessed.length === 1, "duplicate does not add a guess");

run = guessHangmanLetter(run, "t").run;
run = guessHangmanLetter(run, "h").run;
run = guessHangmanLetter(run, "e").run;
run = guessHangmanLetter(run, "l").run;
run = guessHangmanLetter(run, "n").run;
assert(run.status === "won", "revealing every letter wins");
assert(remainingHangmanLives(run) === 8, "correct letters do not cost lives");

let lost = runFrom("Wigan");
for (const letter of ["B", "C", "D", "E", "F", "H", "J", "K"]) {
  lost = guessHangmanLetter(lost, letter).run;
}
assert(lost.status === "lost", "eight wrong letters lose");
assert(wrongGuessCount(lost) === 8, "wrong-letter count is 8");

const apostrophe = runFrom("O'Neill");
assert(isHangmanPunctuation("'"), "O'Neill keeps the apostrophe visible");
const o = guessHangmanLetter(apostrophe, "o").run;
assert(o.guessed.includes("O"), "O is stored uppercase");

const created = createHangmanRun({ date: "2026-09-08", daily: true });
const createdAgain = createHangmanRun({ date: "2026-09-08", daily: true });
assert(created.puzzleId === createdAgain.puzzleId, "daily hangman is stable for the date");
assert(created.daily, "daily flag is set");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
