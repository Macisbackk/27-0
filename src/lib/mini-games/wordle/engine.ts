import { createRng, createRunId, pickIndex } from "@/lib/quiz/rng";
import { getWordlePlayerPool, resolvePlayerGuess, type MiniGamePlayer } from "../players";
import type { MiniGamePoolMode } from "../pool-mode";
import { mergeDiscoveredClues } from "./run-utils";
export { mergeDiscoveredClues, normalizeWordleRun, createEmptyWordleStats } from "./run-utils";
import {
  WORDLE_ATTRIBUTE_LABEL,
  WORDLE_MAX_GUESSES,
  wordleStatusLabel,
  type WordleAnswerHint,
  type WordleAttributeKey,
  type WordleClues,
  type WordleDiscoveredClue,
  type WordleGuess,
  type WordleRun,
  type WordleStats,
  type WordleTrend,
} from "./types";

export { WORDLE_MAX_GUESSES, wordleStatusLabel };

const WORDLE_HINT_KEYS: WordleAttributeKey[] = [
  "nationality",
  "position",
  "club",
  "rating",
  "age",
];

export const WORDLE_ATTRIBUTE_COUNT = WORDLE_HINT_KEYS.length;

function trend(guess: number, answer: number): WordleTrend {
  if (guess === answer) return "match";
  return guess < answer ? "higher" : "lower";
}

/** Position units for the "close" position clue. */
const POSITION_UNIT: Record<string, "backs" | "halves" | "forwards"> = {
  FULLBACK: "backs",
  WING: "backs",
  CENTRE: "backs",
  STAND_OFF: "halves",
  SCRUM_HALF: "halves",
  PROP: "forwards",
  HOOKER: "forwards",
  SECOND_ROW: "forwards",
  LOOSE_FORWARD: "forwards",
};

export function wordlePositionUnit(position: string): "backs" | "halves" | "forwards" | null {
  return POSITION_UNIT[position] ?? null;
}

/** Decade of a card season (1990s, 2000s…). */
export function wordleDecade(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function wordleEraLabel(year: number): string {
  return `${wordleDecade(year)}s`;
}

export function buildWordleClues(
  guess: MiniGamePlayer,
  answer: MiniGamePlayer
): WordleClues {
  const unit = wordlePositionUnit(guess.position);
  return {
    nationality:
      guess.nationalityKey === answer.nationalityKey ? "match" : "miss",
    position:
      guess.position === answer.position
        ? "match"
        : unit && unit === wordlePositionUnit(answer.position)
          ? "close"
          : "miss",
    club: guess.clubId === answer.clubId ? "match" : "miss",
    rating: trend(guess.rating, answer.rating),
    age: trend(guess.age, answer.age),
    status: guess.isHistoric === answer.isHistoric ? "match" : "miss",
    era: trend(wordleDecade(guess.year), wordleDecade(answer.year)),
  };
}

export function answerHintValue(
  answer: MiniGamePlayer,
  key: WordleAttributeKey
): string {
  switch (key) {
    case "nationality":
      return answer.nationality;
    case "position":
      return answer.positionLabel;
    case "club":
      return answer.club;
    case "rating":
      return String(answer.rating);
    case "age":
      return String(answer.age);
    case "status":
      return wordleStatusLabel(answer.isHistoric);
  }
}

export function buildWordleAnswerHint(
  answer: MiniGamePlayer,
  key: WordleAttributeKey
): WordleAnswerHint {
  return {
    key,
    label: WORDLE_ATTRIBUTE_LABEL[key],
    value: answerHintValue(answer, key),
  };
}

/** Prefer attributes not already unlocked by matching guesses. */
export function pickWordleHintKey(
  runId: string,
  alreadyKnown: readonly WordleAttributeKey[]
): WordleAttributeKey | null {
  const known = new Set(alreadyKnown);
  const candidates = WORDLE_HINT_KEYS.filter((key) => !known.has(key));
  if (candidates.length === 0) return null;
  const rng = createRng(`wordle-hint:${runId}`);
  return candidates[pickIndex(rng, candidates.length)]!;
}

export function useWordleHint(
  run: WordleRun,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): { run: WordleRun; error?: string; hint?: WordleAnswerHint } {
  if (run.status !== "playing") {
    return { run, error: "This Wordle is already finished." };
  }
  if (run.hintUsed || run.answerHint) {
    return { run, error: "You already used the reveal clue." };
  }
  const answer = pool.find((player) => player.id === run.answerId);
  if (!answer) {
    return { run, error: "Could not load this Wordle player." };
  }
  const knownKeys = run.discoveredClues.map((clue) => clue.key);
  const key = pickWordleHintKey(run.date, knownKeys);
  if (!key) {
    return { run, error: "All attributes are already unlocked." };
  }
  const hint = buildWordleAnswerHint(answer, key);
  return {
    run: {
      ...run,
      hintUsed: true,
      answerHint: hint,
    },
    hint,
  };
}

export function pickWordlePlayer(
  seed: string,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): MiniGamePlayer {
  if (pool.length === 0) {
    throw new Error("Wordle player pool is empty");
  }
  const rng = createRng(`wordle:${seed}`);
  return pool[pickIndex(rng, pool.length)]!;
}

/** @deprecated Use pickWordlePlayer — kept for older call sites/tests. */
export function pickDailyWordlePlayer(
  date: string,
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool()
): MiniGamePlayer {
  return pickWordlePlayer(date, pool);
}

export function createWordleRun(
  pool: readonly MiniGamePlayer[] = getWordlePlayerPool(),
  seed: string = createRunId(),
  poolMode?: MiniGamePoolMode
): WordleRun {
  const answer = pickWordlePlayer(seed, pool);
  return {
    date: seed,
    answerId: answer.id,
    guesses: [],
    discoveredClues: [],
    hintUsed: false,
    answerHint: null,
    status: "playing",
    rewardClaimed: false,
    poolMode,
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
    return { run, error: "This Wordle is already finished." };
  }
  const answer = pool.find((player) => player.id === run.answerId);
  if (!answer) {
    return { run, error: "Could not load this Wordle player." };
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
    age: resolved.age,
    isHistoric: resolved.isHistoric,
    eraLabel: wordleEraLabel(resolved.year),
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
    schemaVersion: 3,
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


/**
 * Spoiler-free share text. Using the optional reveal clue is free but marked on the share
 * ("hint used"), Wordle-style.
 */
export function buildWordleShareText(run: WordleRun, poolModeLabel?: string): string {
  const score = run.status === "won" ? `${run.guesses.length}/${WORDLE_MAX_GUESSES}` : `X/${WORDLE_MAX_GUESSES}`;
  const tone = (t: string | undefined) => (t === "match" ? "🟩" : t === "close" ? "🟨" : "⬛");
  const rows = run.guesses.map((g) =>
    [g.clues.club, g.clues.position, g.clues.nationality, g.clues.age, g.clues.rating].map(tone).join("")
  );
  const header = [`Rugby League Wordle ${score}`, poolModeLabel, run.hintUsed ? "hint used" : null]
    .filter(Boolean)
    .join(" · ");
  return [header, ...rows, "27-0.co.uk/mini-games/wordle"].join("\n");
}
