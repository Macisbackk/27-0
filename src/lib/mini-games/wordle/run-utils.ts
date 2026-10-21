/** Wordle run/stat helpers with no player-database dependency (used by storage). */
import {
  WORDLE_ATTRIBUTE_LABEL,
  type WordleAttributeKey,
  type WordleClues,
  type WordleDiscoveredClue,
  type WordleRun,
  type WordleStats,
} from "./types";

export function matchingAttributes(clues: WordleClues): WordleAttributeKey[] {
  const keys: WordleAttributeKey[] = [];
  if (clues.nationality === "match") keys.push("nationality");
  if (clues.position === "match") keys.push("position");
  if (clues.club === "match") keys.push("club");
  if (clues.rating === "match") keys.push("rating");
  if (clues.age === "match") keys.push("age");
  // Status is fixed by Current/Era pool choice — never treat as a discovery clue.
  return keys;
}

export function mergeDiscoveredClues(
  existing: readonly WordleDiscoveredClue[],
  clues: WordleClues
): { discovered: WordleDiscoveredClue[]; newlyFound: WordleDiscoveredClue[] } {
  const known = new Set(existing.map((clue) => clue.key));
  const newlyFound: WordleDiscoveredClue[] = [];
  let order = existing.length;
  for (const key of matchingAttributes(clues)) {
    if (known.has(key)) continue;
    order += 1;
    newlyFound.push({
      key,
      label: WORDLE_ATTRIBUTE_LABEL[key],
      order,
    });
    known.add(key);
  }
  return {
    discovered: [...existing, ...newlyFound],
    newlyFound,
  };
}

function normalizeGuessClues(clues: WordleClues): WordleClues {
  return {
    nationality: clues.nationality ?? "miss",
    position: clues.position ?? "miss",
    club: clues.club ?? "miss",
    rating: clues.rating ?? "miss",
    age: clues.age ?? "miss",
    status: clues.status ?? "miss",
  };
}

/** Migrate older persisted runs. */
export function normalizeWordleRun(value: WordleRun): WordleRun {
  const guesses = value.guesses.map((guess) => ({
    ...guess,
    age: typeof guess.age === "number" ? guess.age : 0,
    isHistoric: Boolean(guess.isHistoric),
    clues: normalizeGuessClues(guess.clues),
  }));
  const discovered =
    Array.isArray(value.discoveredClues) && value.discoveredClues.length > 0
      ? value.discoveredClues
      : guesses.reduce<WordleDiscoveredClue[]>((acc, guess) => {
          return mergeDiscoveredClues(acc, guess.clues).discovered;
        }, []);
  return {
    ...value,
    guesses,
    discoveredClues: discovered,
    hintUsed: Boolean(value.hintUsed || value.answerHint),
    answerHint: value.answerHint ?? null,
  };
}

export function createEmptyWordleStats(): WordleStats {
  return {
    schemaVersion: 3,
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: null,
  };
}
