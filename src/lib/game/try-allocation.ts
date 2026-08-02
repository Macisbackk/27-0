import type { Position } from "../types";
import { getInMatchMultiTryMultiplier } from "./multi-try";

export interface MatchTryAllocContext {
  positions: Position[];
  ratings: number[];
  seasonTotalsSoFar: number[];
}

export function sanitizeTryWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) return 0;
  return weight;
}

/**
 * Weighted pick that never collapses NaN/zero totals onto index 0 or last.
 * Uniform among all slots when the sum is invalid.
 */
export function pickWeightedIndexSafe(
  weights: number[],
  rng: () => number
): number {
  if (weights.length === 0) return -1;
  const clean = weights.map(sanitizeTryWeight);
  const sum = clean.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    return Math.floor(rng() * clean.length);
  }
  let pick = rng() * sum;
  for (let i = 0; i < clean.length; i++) {
    pick -= clean[i]!;
    if (pick <= 0) return i;
  }
  return clean.length - 1;
}

/**
 * Distribute integer tries across weighted players for one match.
 * Each try is assigned independently with diminishing multi-try odds.
 */
export function allocateMatchTries(
  matchTries: number,
  baseWeights: number[],
  rng: () => number,
  context?: MatchTryAllocContext
): number[] {
  const allocated = new Array(baseWeights.length).fill(0) as number[];
  if (matchTries <= 0 || baseWeights.length === 0) return allocated;

  const cleanBase = baseWeights.map(sanitizeTryWeight);
  const weightSum = cleanBase.reduce((sum, w) => sum + w, 0);
  if (!(weightSum > 0)) {
    // Uniform distribution — never dump every try on index 0.
    for (let t = 0; t < matchTries; t++) {
      const i = Math.floor(rng() * cleanBase.length);
      allocated[i]!++;
    }
    return allocated;
  }

  const hasContext =
    context &&
    context.positions.length === baseWeights.length &&
    context.ratings.length === baseWeights.length &&
    context.seasonTotalsSoFar.length === baseWeights.length;

  if (!hasContext) {
    return allocateMatchTriesLegacy(matchTries, cleanBase, rng);
  }

  for (let t = 0; t < matchTries; t++) {
    const effective = cleanBase.map((w, i) => {
      const rating = Number.isFinite(context.ratings[i])
        ? context.ratings[i]!
        : 55;
      const inMatchMult = getInMatchMultiTryMultiplier(
        allocated[i]!,
        context.positions[i]!,
        rating,
        context.seasonTotalsSoFar[i]!,
        matchTries
      );
      return sanitizeTryWeight(w * inMatchMult);
    });
    // Floor tiny positive weights so diminishing returns never become NaN.
    const floored = effective.map((w) => (w > 0 ? Math.max(0.0001, w) : 0));
    const pick = pickWeightedIndexSafe(floored, rng);
    if (pick < 0) break;
    allocated[pick]!++;
  }

  return allocated;
}

/** Legacy proportional split — used when position context unavailable. */
function allocateMatchTriesLegacy(
  matchTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const allocated = new Array(weights.length).fill(0) as number[];
  const clean = weights.map(sanitizeTryWeight);
  const weightSum = clean.reduce((sum, w) => sum + w, 0);
  if (!(weightSum > 0)) {
    for (let t = 0; t < matchTries; t++) {
      allocated[Math.floor(rng() * clean.length)]!++;
    }
    return allocated;
  }

  const rawShares = clean.map((w) => (w / weightSum) * matchTries);
  const floors = rawShares.map((share) => Math.floor(share));
  let remainder = matchTries - floors.reduce((sum, n) => sum + n, 0);

  for (let i = 0; i < floors.length; i++) {
    allocated[i] = floors[i]!;
  }

  const fractional = rawShares
    .map((share, i) => ({ i, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || rng() - 0.5);

  for (const { i } of fractional) {
    if (remainder <= 0) break;
    allocated[i]!++;
    remainder--;
  }

  return allocated;
}
