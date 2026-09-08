import { createRng, pickIndex } from "@/lib/quiz/rng";
import { getWordlePlayerPool, resolvePlayerGuess, type MiniGamePlayer } from "../players";
import {
  WORDLE_MAX_GUESSES,
  type WordleClues,
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
    club: guess.club.toLowerCase() === answer.club.toLowerCase() ? "match" : "miss",
    position: guess.position === answer.position ? "match" : "miss",
    nationality:
      guess.nationality.toLowerCase() === answer.nationality.toLowerCase()
        ? "match"
        : "miss",
    rating: trend(guess.rating, answer.rating),
    year: trend(guess.year, answer.year),
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
): { run: WordleRun; error?: string } {
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
  if (run.guesses.some((guess) => guess.playerId === resolved.id)) {
    return { run, error: "You already guessed that player." };
  }

  const guess: WordleGuess = {
    playerId: resolved.id,
    name: resolved.displayName,
    club: resolved.club,
    positionLabel: resolved.positionLabel,
    nationality: resolved.nationality,
    rating: resolved.rating,
    year: resolved.year,
    isHistoric: resolved.isHistoric,
    clues: buildWordleClues(resolved, answer),
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
      status,
    },
  };
}

export function createEmptyWordleStats(): WordleStats {
  return {
    schemaVersion: 1,
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
