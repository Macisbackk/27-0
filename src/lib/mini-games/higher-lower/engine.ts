import { createRng, createRunId, pickIndex, shuffledCopy } from "@/lib/quiz/rng";
import {
  findMiniGamePlayerById,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "../players";
import type {
  HigherLowerChoice,
  HigherLowerRun,
  HigherLowerStats,
} from "./types";

export const HIGHER_LOWER_HISTORY_SIZE = 5;

type GapBand = { min: number; max: number };

function gapBandForStreak(streak: number): GapBand {
  if (streak <= 2) return { min: 8, max: 35 };
  if (streak <= 5) return { min: 4, max: 14 };
  if (streak <= 9) return { min: 2, max: 8 };
  return { min: 1, max: 5 };
}

function ratingGap(a: MiniGamePlayer, b: MiniGamePlayer): number {
  return Math.abs(a.rating - b.rating);
}

function pickFromBand(
  base: MiniGamePlayer,
  pool: readonly MiniGamePlayer[],
  band: GapBand,
  usedIds: Set<string>,
  rng: () => number
): MiniGamePlayer | null {
  const partners = pool.filter((player) => {
    if (usedIds.has(player.id) || usedIds.has(player.identityId)) return false;
    if (player.identityId === base.identityId) return false;
    if (player.rating === base.rating) return false;
    const gap = ratingGap(base, player);
    return gap >= band.min && gap <= band.max;
  });
  if (partners.length === 0) return null;
  return partners[pickIndex(rng, partners.length)]!;
}

export function pickChallengePlayer(
  seed: string,
  roundIndex: number,
  base: MiniGamePlayer,
  pool: readonly MiniGamePlayer[],
  usedIds: readonly string[],
  streak: number
): MiniGamePlayer {
  const rng = createRng(`${seed}:challenge:${roundIndex}`);
  const used = new Set(usedIds);
  used.add(base.id);
  used.add(base.identityId);
  const bands: GapBand[] = [
    gapBandForStreak(streak),
    { min: 1, max: 20 },
    { min: 1, max: 99 },
  ];
  for (const band of bands) {
    const pick = pickFromBand(base, pool, band, used, rng);
    if (pick) return pick;
  }
  const fallback = shuffledCopy(pool, rng).find(
    (player) =>
      player.identityId !== base.identityId &&
      player.rating !== base.rating &&
      !used.has(player.id)
  );
  if (!fallback) {
    throw new Error("Higher or Lower pool is too small");
  }
  return fallback;
}

export function createHigherLowerRun(
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool(),
  seed: string = createRunId()
): HigherLowerRun {
  if (pool.length < HIGHER_LOWER_HISTORY_SIZE + 2) {
    throw new Error("Higher or Lower pool is too small");
  }
  const rng = createRng(`${seed}:seed`);
  const shuffled = shuffledCopy(pool, rng);
  const history = shuffled.slice(0, HIGHER_LOWER_HISTORY_SIZE);
  const base = history[history.length - 1]!;
  const used = history.flatMap((player) => [player.id, player.identityId]);
  const challenge = pickChallengePlayer(seed, 0, base, pool, used, 0);
  return {
    seed,
    roundIndex: 0,
    historyIds: history.map((player) => player.id),
    baseId: base.id,
    challengeId: challenge.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
    status: "playing",
  };
}

export function resolveHigherLowerPlayers(
  run: HigherLowerRun,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): {
  history: MiniGamePlayer[];
  base: MiniGamePlayer;
  challenge: MiniGamePlayer;
} | null {
  const history = run.historyIds
    .map((id) => findMiniGamePlayerById(id, pool))
    .filter((player): player is MiniGamePlayer => Boolean(player));
  const base = findMiniGamePlayerById(run.baseId, pool);
  const challenge = findMiniGamePlayerById(run.challengeId, pool);
  if (!base || !challenge || history.length === 0) return null;
  return { history, base, challenge };
}

export function answerHigherLower(
  run: HigherLowerRun,
  choice: HigherLowerChoice,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): { run: HigherLowerRun; correct: boolean } {
  if (run.status !== "playing" || run.revealed) {
    return { run, correct: false };
  }
  const resolved = resolveHigherLowerPlayers(run, pool);
  if (!resolved) return { run, correct: false };
  const { base, challenge } = resolved;
  const challengeIsHigher = challenge.rating > base.rating;
  const correct =
    (choice === "higher" && challengeIsHigher) ||
    (choice === "lower" && !challengeIsHigher);
  return {
    run: {
      ...run,
      revealed: true,
      lastChoice: choice,
      lastCorrect: correct,
      status: correct ? "playing" : "lost",
    },
    correct,
  };
}

export function advanceHigherLower(
  run: HigherLowerRun,
  streak: number,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): HigherLowerRun {
  const resolved = resolveHigherLowerPlayers(run, pool);
  if (!resolved) return run;
  const nextHistory = [...run.historyIds, run.challengeId].slice(
    -HIGHER_LOWER_HISTORY_SIZE
  );
  const used = nextHistory.flatMap((id) => {
    const player = findMiniGamePlayerById(id, pool);
    return player ? [player.id, player.identityId] : [id];
  });
  const nextRound = run.roundIndex + 1;
  const challenge = pickChallengePlayer(
    run.seed,
    nextRound,
    resolved.challenge,
    pool,
    used,
    streak
  );
  return {
    seed: run.seed,
    roundIndex: nextRound,
    historyIds: nextHistory,
    baseId: resolved.challenge.id,
    challengeId: challenge.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
    status: "playing",
  };
}

export function createEmptyHigherLowerStats(): HigherLowerStats {
  return {
    schemaVersion: 2,
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
    schemaVersion: 2,
    plays: stats.plays + 1,
    correct: stats.correct + (correct ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
  };
}
