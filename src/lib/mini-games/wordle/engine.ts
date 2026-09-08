import { createRng, pickIndex } from "@/lib/quiz/rng";
import { getWordlePlayerPool, resolvePlayerGuess, type MiniGamePlayer } from "../players";
import {
  WORDLE_ATTRIBUTE_LABEL,
  WORDLE_MAX_GUESSES,
  type WordleAttributeKey,
  type WordleClues,
  type WordleDiscoveredClue,
  type WordleGuess,
  type WordleRun,
  type WordleStats,
  type WordleTrend,
} from "./types";

export { WORDLE_MAX_GUESSES };

function trend(guess: number, answer: number): WordleTrend {
  if (guess === answer) return "match";
  return guess < answer ? "higher" : "lower";
}

export function buildWordleClues(
  guess: MiniGamePlayer,
  answer: MiniGamePlayer
): WordleClues {
  return {
    nationality:
      guess.nationalityKey === answer.nationalityKey ? "match" : "miss",
    position: guess.position === answer.position ? "match" : "miss",
    club: guess.clubId === answer.clubId ? "match" : "miss",
    rating: trend(guess.rating, answer.rating),
  };
}

function matchingAttributes(clues: WordleClues): WordleAttributeKey[] {
  const keys: WordleAttributeKey[] = [];
  if (clues.nationality === "match") keys.push("nationality");
  if (clues.position === "match") keys.push("position");
  if (clues.club === "match") keys.push("club");
  if (clues.rating === "match") keys.push("rating");
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

export function pickDailyWordlePlayer(
  date: string,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): MiniGamePlayer {
  if (pool.length === 0) {
    throw new Error("Wordle player pool is empty");
  }
  const rng = createRng(`wordle:${date}`);
  return pool[pickIndex(rng, pool.length)]!;
}

export function createWordleRun(
  date: string,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): WordleRun {
  const answer = pickDailyWordlePlayer(date, pool);
  return {
    date,
    answerId: answer.id,
    guesses: [],
    discoveredClues: [],
    status: "playing",
    rewardClaimed: false,
  };
}

export function isSameWordlePlayer(
  guess: MiniGamePlayer,
  answer: MiniGamePlayer
): boolean {
  return guess.identityId === answer.identityId;
}

export function submitWordleGuess(
  run: WordleRun,
  query: string,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): { run: WordleRun; error?: string; newlyFound?: WordleDiscoveredClue[] } {
  if (run.status !== "playing") {
    return { run, error: "Today's Wordle is already finished." };
  }
  const answer = pool.find((player) => player.id === run.answerId);
  if (!answer) {
    return { run, error: "Could not load today's player." };
  }
  const resolved = resolvePlayerGuess(query, pool);
  if (!resolved) {
    return { run, error: "No matching Super League player." };
  }
  if (
    run.guesses.some(
      (guess) =>
        guess.playerId === resolved.id ||
        guess.playerId === resolved.identityId
    )
  ) {
    return { run, error: "You already guessed that player." };
  }
  if (resolved.identityId === answer.identityId && resolved.id !== answer.id) {
    // Same person via another card — treat as correct answer path below.
  } else if (
    run.guesses.some((guess) => {
      const prior = pool.find((player) => player.id === guess.playerId);
      return prior?.identityId === resolved.identityId;
    })
  ) {
    return { run, error: "You already guessed that player." };
  }

  const clues = buildWordleClues(resolved, answer);
  const { discovered, newlyFound } = mergeDiscoveredClues(
    run.discoveredClues,
    clues
  );
  const guess: WordleGuess = {
    playerId: resolved.id,
    name: resolved.displayName,
    club: resolved.club,
    positionLabel: resolved.positionLabel,
    nationality: resolved.nationality,
    rating: resolved.rating,
    clues,
  };
  const guesses = [...run.guesses, guess];
  const won = isSameWordlePlayer(resolved, answer);
  let status: WordleRun["status"] = "playing";
  if (won) status = "won";
  else if (guesses.length >= WORDLE_MAX_GUESSES) status = "lost";

  return {
    run: {
      ...run,
      guesses,
      discoveredClues: discovered,
      status,
    },
    newlyFound,
  };
}

export function createEmptyWordleStats(): WordleStats {
  return {
    schemaVersion: 2,
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: null,
  };
}

export function recordWordleResult(
  stats: WordleStats,
  run: WordleRun
): WordleStats {
  if (run.status === "playing") return stats;
  if (stats.lastPlayedDate === run.date) return stats;
  const won = run.status === "won";
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    ...stats,
    schemaVersion: 2,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastPlayedDate: run.date,
  };
}

export function remainingWordleGuesses(run: WordleRun): number {
  return Math.max(0, WORDLE_MAX_GUESSES - run.guesses.length);
}

/** Migrate older persisted runs that lack discoveredClues / still store year. */
export function normalizeWordleRun(value: WordleRun): WordleRun {
  const discovered =
    Array.isArray(value.discoveredClues) && value.discoveredClues.length > 0
      ? value.discoveredClues
      : value.guesses.reduce<WordleDiscoveredClue[]>((acc, guess) => {
          return mergeDiscoveredClues(acc, guess.clues).discovered;
        }, []);
  return {
    ...value,
    discoveredClues: discovered,
  };
}
