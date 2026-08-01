import type { Position } from "../types";
import { getInMatchMultiTryMultiplier } from "../game/multi-try";

export function sanitizeWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) return 0;
  return weight;
}

/** Weighted pick that never collapses NaN/zero totals onto index 0. */
export function pickWeightedIndexSafe(
  weights: number[],
  rng: () => number
): number {
  if (weights.length === 0) return -1;
  const clean = weights.map(sanitizeWeight);
  const sum = clean.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    const pool = clean.map((_, i) => i);
    return pool[Math.floor(rng() * pool.length)] ?? 0;
  }
  let roll = rng() * sum;
  for (let i = 0; i < clean.length; i++) {
    roll -= clean[i]!;
    if (roll <= 0) return i;
  }
  return clean.length - 1;
}

/**
 * Relative try likelihood for starters — backs finish most tries in rugby league;
 * forwards chip in occasionally (hooker/loose forward) and props very rarely.
 */
const STARTER_TRY_WEIGHT: Record<Position, number> = {
  WING: 1.5,
  CENTRE: 1.15,
  FULLBACK: 1.05,
  STAND_OFF: 0.72,
  SCRUM_HALF: 0.68,
  HOOKER: 0.32,
  LOOSE_FORWARD: 0.22,
  SECOND_ROW: 0.14,
  PROP: 0.1,
};

/** Bench share of starter rate — interchange backs can score; forwards almost never. */
const BENCH_TRY_SHARE: Record<Position, number> = {
  WING: 0.4,
  CENTRE: 0.35,
  FULLBACK: 0.38,
  STAND_OFF: 0.28,
  SCRUM_HALF: 0.26,
  HOOKER: 0.12,
  LOOSE_FORWARD: 0.08,
  SECOND_ROW: 0.06,
  PROP: 0.05,
};

export function getMatchdayTryWeight(
  position: Position,
  isInterchange: boolean
): number {
  const starter = STARTER_TRY_WEIGHT[position] ?? 0.5;
  if (!isInterchange) return starter;
  const benchShare = BENCH_TRY_SHARE[position] ?? 0.12;
  return starter * benchShare;
}

/**
 * Distribute a try total across players by weight.
 * Each try is drawn independently with diminishing multi-try odds.
 */
export function allocateWeightedTries(
  totalTries: number,
  weights: number[],
  rng: () => number,
  context?: {
    positions?: Position[];
    ratings?: number[];
  }
): number[] {
  const alloc = new Array(weights.length).fill(0) as number[];
  if (totalTries <= 0 || weights.length === 0) return alloc;

  const base = weights.map(sanitizeWeight);
  if (base.every((w) => w <= 0)) {
    // Uniform among all slots rather than collapsing to index 0.
    for (let t = 0; t < totalTries; t++) {
      const i = Math.floor(rng() * base.length);
      alloc[i]!++;
    }
    return alloc;
  }

  for (let t = 0; t < totalTries; t++) {
    const effective = base.map((w, i) => {
      const pos = context?.positions?.[i];
      const rating = context?.ratings?.[i] ?? 70;
      if (!pos) {
        // Mild generic diminishing when position context unavailable.
        const already = alloc[i] ?? 0;
        const mult =
          already <= 0
            ? 1
            : already === 1
              ? 0.42
              : already === 2
                ? 0.18
                : 0.06;
        return sanitizeWeight(w * mult);
      }
      return sanitizeWeight(
        w *
          getInMatchMultiTryMultiplier(
            alloc[i] ?? 0,
            pos,
            rating,
            0,
            totalTries
          )
      );
    });
    const pick = pickWeightedIndexSafe(effective, rng);
    if (pick < 0) break;
    alloc[pick]!++;
  }
  return alloc;
}
