import type { Position } from "../types";

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

/** Distribute a try total across players by weight (used in scoring fallbacks). */
export function allocateWeightedTries(
  totalTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const alloc = new Array(weights.length).fill(0);
  for (let t = 0; t < totalTries; t++) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let roll = rng() * sum;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        alloc[i]++;
        break;
      }
    }
  }
  return alloc;
}
