/**
 * Wordle engine tests.
 * Run: npx tsx scripts/test-wordle-engine.ts
 */
import {
  buildWordleClues,
  createEmptyWordleStats,
  createWordleRun,
  isSameWordlePlayer,
  mergeDiscoveredClues,
  pickWordlePlayer,
  recordWordleResult,
  submitWordleGuess,
  useWordleHint,
  WORDLE_MAX_GUESSES,
} from "../src/lib/mini-games/wordle/engine";
import { resolvePlayerGuess, getWordlePlayerPool, type MiniGamePlayer } from "../src/lib/mini-games/players";

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
  const club = partial.club ?? "Leeds Rhinos";
  const nationality = partial.nationality ?? "England";
  return {
    identityId: partial.identityId ?? partial.id,
    club,
    clubId: partial.clubId ?? club.toLowerCase().replace(/\s+/g, "-"),
    position: "STAND_OFF",
    positionLabel: "Stand Off",
    nationality,
    nationalityKey: nationality.toLowerCase(),
    rating: 90,
    age: 28,
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
    age: 29,
    year: 2009,
    clubId: "leeds",
  }),
  player({
    id: "rob-burrow-2007",
    identityId: "rob-burrow",
    displayName: "Rob Burrow",
    club: "Leeds Rhinos",
    clubId: "leeds",
    position: "SCRUM_HALF",
    positionLabel: "Scrum Half",
    nationality: "England",
    nationalityKey: "england",
    rating: 91,
    age: 25,
    year: 2007,
  }),
  player({
    id: "mike-cooper",
    identityId: "michael-cooper",
    displayName: "Michael Cooper",
    club: "Warrington Wolves",
    clubId: "warrington",
    position: "PROP",
    positionLabel: "Prop",
    nationality: "England",
    nationalityKey: "england",
    rating: 82,
    age: 32,
    year: 2026,
    isHistoric: false,
  }),
  player({
    id: "sam-tomkins-2012",
    identityId: "sam-tomkins",
    displayName: "Sam Tomkins",
    club: "Wigan Warriors",
    clubId: "wigan",
    position: "FULLBACK",
    positionLabel: "Fullback",
    nationality: "England",
    nationalityKey: "england",
    rating: 93,
    age: 23,
    year: 2012,
  }),
];

console.log("Wordle engine");

const a = pickWordlePlayer("seed-a", pool);
const b = pickWordlePlayer("seed-a", pool);
assert(a.id === b.id, "same seed returns the same player");
assert(WORDLE_MAX_GUESSES === 6, "six guesses");

const clues = buildWordleClues(pool[1]!, pool[0]!);
assert(clues.club === "match", "same club is a match");
assert(clues.position === "miss", "different position is a miss");
assert(clues.nationality === "match", "same nation is a match");
assert(clues.rating === "higher", "lower guess rating points higher");
assert(clues.age === "higher", "younger guess age points higher");
assert(clues.status === "match", "both historic is a status match");
assert(!("year" in clues), "year is not a clue attribute");

const statusMiss = buildWordleClues(pool[2]!, pool[0]!);
assert(statusMiss.status === "miss", "current vs historic is a status miss");

const merged = mergeDiscoveredClues([], clues);
assert(merged.newlyFound.length === 3, "first guess unlocks three clues");
assert(merged.newlyFound[0]?.order === 1, "clues are numbered from 1");
const again = mergeDiscoveredClues(merged.discovered, clues);
assert(again.newlyFound.length === 0, "duplicate attribute clues are not repeated");

assert(
  isSameWordlePlayer(
    pool[0]!,
    player({
      id: "kevin-sinfield-2012",
      identityId: "kevin-sinfield",
      displayName: "Kevin Sinfield",
    })
  ),
  "identity match counts as the same player"
);

assert(
  resolvePlayerGuess("mike cooper", pool)?.id === "mike-cooper",
  "Mike resolves to Michael Cooper"
);

let run = createWordleRun(pool, "lose-seed");
assert(run.status === "playing", "new run is in progress");
assert(run.discoveredClues.length === 0, "new run has no clues yet");
const extras: MiniGamePlayer[] = Array.from({ length: 6 }, (_, i) =>
  player({
    id: `decoy-${i}`,
    identityId: `decoy-${i}`,
    displayName: `Decoy ${i}`,
    club: "Wigan Warriors",
    clubId: "wigan",
    position: "WING",
    positionLabel: "Wing",
    nationality: "Australia",
    nationalityKey: "australia",
    rating: 70 + i,
    year: 2000 + i,
    isHistoric: true,
  })
);
const losePool = [...pool, ...extras];
for (const decoy of extras) {
  const next = submitWordleGuess(run, decoy.id, losePool);
  run = next.run;
}
assert(run.status === "lost", "six wrong guesses lose the round");

const winRun = createWordleRun(pool, "win-seed");
const won = submitWordleGuess(winRun, winRun.answerId, pool);
assert(won.run.status === "won", "correct player wins");

const stats = recordWordleResult(createEmptyWordleStats(), won.run);
assert(stats.wins === 1 && stats.currentStreak === 1, "win updates streak");
const againStats = recordWordleResult(stats, won.run);
assert(againStats.played === stats.played, "same run is not counted twice");

const secondWin = createWordleRun(pool, "win-seed-2");
const secondWon = submitWordleGuess(secondWin, secondWin.answerId, pool);
const streakStats = recordWordleResult(stats, secondWon.run);
assert(streakStats.played === 2, "a new run counts again");
assert(streakStats.currentStreak === 2, "wins keep the streak going");

const hintRun = createWordleRun(pool, "hint-seed");
assert(hintRun.hintUsed === false, "new run has unused hint");
const hinted = useWordleHint(hintRun, pool);
assert(Boolean(hinted.hint), "hint reveals one attribute");
assert(hinted.run.hintUsed === true, "hint is marked used");
assert(
  hinted.hint?.value !== undefined && hinted.hint.value.length > 0,
  "hint includes a value"
);
const secondHint = useWordleHint(hinted.run, pool);
assert(Boolean(secondHint.error), "second hint is blocked");

console.log("\nWordle current-vs-historic pool");
{
  const live = getWordlePlayerPool();
  const charnley = live.find((p) => p.displayName === "Josh Charnley");
  assert(Boolean(charnley), "Josh Charnley is in the Wordle pool");
  assert(charnley?.club === "Leigh Leopards", "Charnley uses his Leigh card");
  assert(charnley?.isHistoric === false, "Leigh Charnley counts as Current");
  assert(
    !live.some((p) => p.displayName === "Josh Charnley" && p.club === "Wigan Warriors"),
    "historic Wigan Charnley is not a separate Wordle answer"
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
