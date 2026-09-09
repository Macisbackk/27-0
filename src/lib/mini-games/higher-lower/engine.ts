import { createRng, createRunId, pickIndex, shuffledCopy } from "@/lib/quiz/rng";
import {
  findMiniGamePlayerById,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "../players";
import type { MiniGamePoolMode } from "../pool-mode";
import {
  HIGHER_LOWER_PICKS,
  HIGHER_LOWER_STATS_SCHEMA,
  type HigherLowerChoice,
  type HigherLowerRun,
  type HigherLowerStats,
} from "./types";

export { HIGHER_LOWER_PICKS };

type GapBand = { min: number; max: number };

function gapBandForPick(pickIndex: number): GapBand {
  if (pickIndex <= 1) return { min: 8, max: 28 };
  if (pickIndex <= 3) return { min: 4, max: 16 };
  return { min: 2, max: 12 };
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
  pickIndexValue: number,
  base: MiniGamePlayer,
  pool: readonly MiniGamePlayer[],
  usedIds: readonly string[]
): MiniGamePlayer {
  const rng = createRng(`${seed}:challenge:${pickIndexValue}`);
  const used = new Set(usedIds);
  used.add(base.id);
  used.add(base.identityId);
  const bands: GapBand[] = [
    gapBandForPick(pickIndexValue),
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
      !used.has(player.id) &&
      !used.has(player.identityId)
  );
  if (!fallback) {
    throw new Error("Higher or Lower pool is too small");
  }
  return fallback;
}

function usedKeys(player: MiniGamePlayer): string[] {
  return [player.id, player.identityId];
}

export function createHigherLowerRun(
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool(),
  seed: string = createRunId(),
  poolMode?: MiniGamePoolMode
): HigherLowerRun {
  if (pool.length < HIGHER_LOWER_PICKS + 1) {
    throw new Error("Higher or Lower pool is too small");
  }
  const rng = createRng(`${seed}:seed`);
  const shuffled = shuffledCopy(pool, rng);
  const base = shuffled[0]!;
  const challenge = pickChallengePlayer(seed, 0, base, pool, usedKeys(base));
  return {
    seed,
    pickIndex: 0,
    usedIds: [...usedKeys(base), ...usedKeys(challenge)],
    baseId: base.id,
    challengeId: challenge.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
    status: "playing",
    rewardClaimed: false,
    poolMode,
  };
}

export function resolveHigherLowerPlayers(
  run: HigherLowerRun,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): { base: MiniGamePlayer; challenge: MiniGamePlayer } | null {
  const base = findMiniGamePlayerById(run.baseId, pool);
  const challenge = findMiniGamePlayerById(run.challengeId, pool);
  if (!base || !challenge) return null;
  return { base, challenge };
}

export function higherLowerPickNumber(run: HigherLowerRun): number {
  return run.pickIndex + 1;
}

export function isFinalHigherLowerPick(run: HigherLowerRun): boolean {
  return run.pickIndex >= HIGHER_LOWER_PICKS - 1;
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
  let status: HigherLowerRun["status"] = "playing";
  if (!correct) status = "lost";
  else if (isFinalHigherLowerPick(run)) status = "won";
  return {
    run: {
      ...run,
      revealed: true,
      lastChoice: choice,
      lastCorrect: correct,
      status,
    },
    correct,
  };
}

export function advanceHigherLower(
  run: HigherLowerRun,
  pool: readonly MiniGamePlayer[] = getHigherLowerPlayerPool()
): HigherLowerRun {
  if (
    run.status !== "playing" ||
    !run.revealed ||
    !run.lastCorrect ||
    isFinalHigherLowerPick(run)
  ) {
    return run;
  }
  const resolved = resolveHigherLowerPlayers(run, pool);
  if (!resolved) return run;
  const nextPick = run.pickIndex + 1;
  if (nextPick >= HIGHER_LOWER_PICKS) return run;
  const nextBase = resolved.challenge;
  const challenge = pickChallengePlayer(
    run.seed,
    nextPick,
    nextBase,
    pool,
    run.usedIds
  );
  return {
    seed: run.seed,
    pickIndex: nextPick,
    usedIds: [...run.usedIds, ...usedKeys(challenge)],
    baseId: nextBase.id,
    challengeId: challenge.id,
    revealed: false,
    lastChoice: null,
    lastCorrect: null,
    status: "playing",
    rewardClaimed: run.rewardClaimed,
  };
}

export function createEmptyHigherLowerStats(): HigherLowerStats {
  return {
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    currentStreak: 0,
    bestStreak: 0,
    plays: 0,
    correct: 0,
    fivePickWins: 0,
    failedRuns: 0,
    lastRewardedRunId: null,
  };
}

export function applyHigherLowerPick(
  stats: HigherLowerStats,
  correct: boolean
): HigherLowerStats {
  return {
    ...stats,
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    correct: stats.correct + (correct ? 1 : 0),
  };
}

export function applyHigherLowerRunEnd(
  stats: HigherLowerStats,
  won: boolean
): HigherLowerStats {
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    ...stats,
    schemaVersion: HIGHER_LOWER_STATS_SCHEMA,
    plays: stats.plays + 1,
    fivePickWins: stats.fivePickWins + (won ? 1 : 0),
    failedRuns: stats.failedRuns + (won ? 0 : 1),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
  };
}
