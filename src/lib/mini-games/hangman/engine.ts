import { createRunId } from "@/lib/quiz/rng";
import type { MiniGamePoolMode } from "../pool-mode";
import { getHangmanBank, pickHangmanPuzzle } from "./answers";
import { HANGMAN_MAX_WRONG, type HangmanRun, type HangmanStats } from "./types";

export { HANGMAN_MAX_WRONG };

const LETTER = /[A-Z]/;

export function normalizeHangmanLetter(raw: string): string | null {
  if (!raw) return null;
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const letter = folded.replace(/[^A-Z]/g, "");
  return letter.length === 1 ? letter : null;
}

export function hangmanLettersInAnswer(answer: string): Set<string> {
  const letters = new Set<string>();
  for (const char of answer.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    if (LETTER.test(char)) letters.add(char);
  }
  return letters;
}

export function isHangmanPunctuation(char: string): boolean {
  const folded = char
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return !LETTER.test(folded);
}

export function wrongGuessCount(run: HangmanRun): number {
  const needed = hangmanLettersInAnswer(run.answer);
  return run.guessed.filter((letter) => !needed.has(letter)).length;
}

export function remainingHangmanLives(run: HangmanRun): number {
  return Math.max(0, HANGMAN_MAX_WRONG - wrongGuessCount(run));
}

export function isHangmanSolved(run: HangmanRun): boolean {
  const needed = hangmanLettersInAnswer(run.answer);
  return [...needed].every((letter) => run.guessed.includes(letter));
}

export function createHangmanRun(options: {
  date: string;
  daily: boolean;
  poolMode: MiniGamePoolMode;
  excludePuzzleId?: string;
}): HangmanRun {
  const seed = options.daily
    ? `hangman-daily:${options.date}:${options.poolMode}`
    : `hangman-practice:${options.poolMode}:${createRunId()}`;
  const puzzle = pickHangmanPuzzle(
    seed,
    getHangmanBank(options.poolMode),
    options.excludePuzzleId
  );
  return {
    id: seed,
    date: options.date,
    daily: options.daily,
    puzzleId: puzzle.id,
    category: puzzle.category,
    answer: puzzle.answer,
    hint: puzzle.hint,
    guessed: [],
    status: "playing",
    rewardClaimed: false,
    isHistoric: puzzle.isHistoric,
    year: puzzle.year,
    poolMode: options.poolMode,
  };
}

export function guessHangmanLetter(
  run: HangmanRun,
  rawLetter: string
): { run: HangmanRun; accepted: boolean } {
  if (run.status !== "playing") return { run, accepted: false };
  const letter = normalizeHangmanLetter(rawLetter);
  if (!letter) return { run, accepted: false };
  if (run.guessed.includes(letter)) return { run, accepted: false };

  const guessed = [...run.guessed, letter];
  const next: HangmanRun = { ...run, guessed };
  if (isHangmanSolved(next)) {
    return { run: { ...next, status: "won" }, accepted: true };
  }
  if (wrongGuessCount(next) >= HANGMAN_MAX_WRONG) {
    return { run: { ...next, status: "lost" }, accepted: true };
  }
  return { run: next, accepted: true };
}

export function createEmptyHangmanStats(): HangmanStats {
  return {
    schemaVersion: 1,
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastDailyWinDate: null,
  };
}

export function recordHangmanResult(
  stats: HangmanStats,
  run: HangmanRun
): HangmanStats {
  if (run.status === "playing") return stats;
  const won = run.status === "won";
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastDailyWinDate:
      won && run.daily ? run.date : stats.lastDailyWinDate,
  };
}
