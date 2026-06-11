import type { Position } from "../types";
import { getInMatchMultiTryMultiplier } from "./multi-try";

export interface MatchTryAllocContext {
  positions: Position[];
  ratings: number[];
  seasonTotalsSoFar: number[];
}

function pickWeightedIndex(weights: number[], rng: () => number): number {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) return 0;
  let pick = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Distribute integer tries across weighted players for one match.
 * Each try is assigned sequentially with diminishing multi-try odds.
 */
export function allocateMatchTries(
  matchTries: number,
  baseWeights: number[],
  rng: () => number,
  context?: MatchTryAllocContext
): number[] {
  const allocated = new Array(baseWeights.length).fill(0);
  if (matchTries <= 0 || baseWeights.length === 0) return allocated;

  const weightSum = baseWeights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return allocated;

  const hasContext =
    context &&
    context.positions.length === baseWeights.length &&
    context.ratings.length === baseWeights.length &&
    context.seasonTotalsSoFar.length === baseWeights.length;

  if (!hasContext) {
    return allocateMatchTriesLegacy(matchTries, baseWeights, rng);
  }

  for (let t = 0; t < matchTries; t++) {
    const effective = baseWeights.map((w, i) => {
      const inMatchMult = getInMatchMultiTryMultiplier(
        allocated[i],
        context.positions[i],
        context.ratings[i],
        context.seasonTotalsSoFar[i],
        matchTries
      );
      return Math.max(0.0001, w * inMatchMult);
    });
    const pick = pickWeightedIndex(effective, rng);
    allocated[pick]++;
  }

  return allocated;
}

/** Legacy proportional split — used when position context unavailable. */
function allocateMatchTriesLegacy(
  matchTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const allocated = new Array(weights.length).fill(0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return allocated;

  const rawShares = weights.map((w) => (w / weightSum) * matchTries);
  const floors = rawShares.map((share) => Math.floor(share));
  let remainder = matchTries - floors.reduce((sum, n) => sum + n, 0);

  for (let i = 0; i < floors.length; i++) {
    allocated[i] = floors[i];
  }

  const fractional = rawShares
    .map((share, i) => ({ i, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || rng() - 0.5);

  for (const { i } of fractional) {
    if (remainder <= 0) break;
    allocated[i]++;
    remainder--;
  }

  return allocated;
}
