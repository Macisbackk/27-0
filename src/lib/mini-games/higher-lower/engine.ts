import { createRng, pickIndex, shuffledCopy } from "@/lib/quiz/rng";
import {
  findMiniGamePlayerById,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "../players";
import type { HigherLowerPair, HigherLowerRun, HigherLowerStats } from "./types";

type GapBand = { min: number; max: number };

function gapBandForRound(roundIndex: number): GapBand {
  if (roundIndex <= 2) return { min: 12, max: 40 };
  if (roundIndex <= 5) return { min: 6, max: 16 };
  if (roundIndex <= 8) return { min: 3, max: 8 };
  return { min: 1, max: 4 };
}

function ratingGap(a: MiniGamePlayer, b: MiniGamePlayer): number {
  return Math.abs(a.rating - b.rating);
}

function eligiblePartner(
  left: MiniGamePlayer,
  pool: readonly MiniGamePlayer[],
  band: GapBand,
  usedIds: Set<string>
): MiniGamePlayer[] {
  return pool.filter((player) => {
    if (player.id === left.id) return false;
    if (player.identityId === left.identityId) return false;
    if (player.rating === left.rating) return false;
    if (usedIds.has(player.id)) return false;
    const gap = ratingGap(left, player);
    return gap >= band.min && gap <= band.max;
  });
}

export function pickHigherLowerPair(
  seed: string,
  roundIndex: number,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool(),
  usedIds: readonly string[] = []
): HigherLowerPair {
  if (pool.length < 2) {
    throw new Error("Higher or Lower pool is too small");
  }
  const rng = createRng(`${seed}:${roundIndex}`);
  const used = new Set(usedIds);
  const shuffled = shuffledCopy(pool, rng);
  const band = gapBandForRound(roundIndex);
  const relaxed: GapBand[] = [
    band,
    { min: 1, max: 40 },
    { min: 1, max: 99 },
  ];

  for (const currentBand of relaxed) {
    for (const left of shuffled) {
      if (used.has(left.id)) continue;
      const partners = eligiblePartner(left, pool, currentBand, used);
      if (partners.length === 0) continue;
      const right = partners[pickIndex(rng, partners.length)]!;
      return rng() < 0.5 ? { left, right } : { left: right, right: left };
    }
  }

  const left = shuffled[0]!;
  const right =
    shuffled.find(
      (player) =>
        player.identityId !== left.identityId && player.rating !== left.rating
    ) ?? shuffled[1]!;
  return { left, right };
}

export function createHigherLowerRun(
  seed: string,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): HigherLowerRun {
  const pair = pickHigherLowerPair(seed, 0, pool);
  return {
    seed,
    roundIndex: 0,
    leftId: pair.left.id,
    rightId: pair.right.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
  };
}

export function resolveHigherLowerPair(
  run: HigherLowerRun,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): HigherLowerPair | null {
  const left = findMiniGamePlayerById(run.leftId, pool);
  const right = findMiniGamePlayerById(run.rightId, pool);
  if (!left || !right) return null;
  return { left, right };
}

export function higherPlayer(
  pair: HigherLowerPair
): "left" | "right" | "tie" {
  if (pair.left.rating === pair.right.rating) return "tie";
  return pair.left.rating > pair.right.rating ? "left" : "right";
}

export function answerHigherLower(
  run: HigherLowerRun,
  choice: "left" | "right",
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): { run: HigherLowerRun; correct: boolean } {
  const pair = resolveHigherLowerPair(run, pool);
  if (!pair || run.revealed) {
    return { run, correct: false };
  }
  const winner = higherPlayer(pair);
  const correct = winner !== "tie" && winner === choice;
  return {
    run: {
      ...run,
      revealed: true,
      lastChoice: choice,
      lastCorrect: correct,
    },
    correct,
  };
}

export function advanceHigherLower(
  run: HigherLowerRun,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): HigherLowerRun {
  const nextIndex = run.roundIndex + 1;
  const pair = pickHigherLowerPair(run.seed, nextIndex, pool, [
    run.leftId,
    run.rightId,
  ]);
  return {
    seed: run.seed,
    roundIndex: nextIndex,
    leftId: pair.left.id,
    rightId: pair.right.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
  };
}

export function createEmptyHigherLowerStats(): HigherLowerStats {
  return {
    schemaVersion: 1,
    currentStreak: 0,
    bestStreak: 0,
    plays: 0,
    correct: 0,
    lastFiveRewardDate: null,
    lastTenRewardDate: null,
  };
}

export function applyHigherLowerResult(
  stats: HigherLowerStats,
  correct: boolean
): HigherLowerStats {
  const currentStreak = correct ? stats.currentStreak + 1 : 0;
  return {
    ...stats,
    plays: stats.plays + 1,
    correct: stats.correct + (correct ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
  };
}
