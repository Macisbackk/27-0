export interface ScorePickContext {
  /** Allow odd scores from drop goals (rare). */
  allowDropGoal?: boolean;
}

/** Scores from tries, conversions, and penalties only (no drop goals — always even). */
const SCORES_NO_DROP_GOAL: number[] = (() => {
  const scores = new Set<number>();
  for (let tries = 0; tries <= 19; tries++) {
    for (let conversions = 0; conversions <= tries; conversions++) {
      for (let penalties = 0; penalties <= 8; penalties++) {
        scores.add(tries * 4 + conversions * 2 + penalties * 2);
      }
    }
  }
  return Array.from(scores).sort((a, b) => a - b);
})();

/** All scores including rare drop goals (multiples of 2 + optional +1). */
const VALID_RL_SCORES: number[] = (() => {
  const scores = new Set<number>(SCORES_NO_DROP_GOAL);
  for (const base of SCORES_NO_DROP_GOAL) {
    for (let dg = 1; dg <= 2; dg++) {
      scores.add(base + dg);
    }
  }
  return Array.from(scores).sort((a, b) => a - b);
})();

export function isValidRLScore(score: number): boolean {
  return VALID_RL_SCORES.includes(score);
}

export function scoreHasDropGoal(score: number): boolean {
  return score % 2 === 1;
}

function pickFromPool(
  pool: number[],
  min: number,
  max: number,
  rng: () => number
): number {
  const options = pool.filter((s) => s >= min && s <= max);
  if (options.length === 0) {
    const fallback = SCORES_NO_DROP_GOAL.filter((s) => s >= min && s <= max);
    if (fallback.length > 0) {
      return fallback[Math.floor(rng() * fallback.length)];
    }
    return SCORES_NO_DROP_GOAL.reduce((best, s) =>
      Math.abs(s - (min + max) / 2) < Math.abs(best - (min + max) / 2)
        ? s
        : best
    );
  }
  return options[Math.floor(rng() * options.length)];
}

export function pickRLScore(
  min: number,
  max: number,
  rng: () => number,
  context: ScorePickContext = {}
): number {
  const pool = context.allowDropGoal ? VALID_RL_SCORES : SCORES_NO_DROP_GOAL;
  return pickFromPool(pool, min, max, rng);
}

export function snapToRLScore(score: number, allowDropGoal = false): number {
  const pool = allowDropGoal ? VALID_RL_SCORES : SCORES_NO_DROP_GOAL;
  if (pool.includes(score)) return score;
  return pool.reduce((best, s) =>
    Math.abs(s - score) < Math.abs(best - score) ? s : best
  );
}

export interface ScoreBreakdown {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
}

function breakdownPreference(b: ScoreBreakdown): number {
  const conversionRate = b.tries > 0 ? b.conversions / b.tries : 0;
  const realisticConv =
    conversionRate >= 0.35 && conversionRate <= 0.7
      ? 12
      : conversionRate > 0.85
        ? -12
        : 0;
  const trySweetSpot = b.tries >= 2 && b.tries <= 5 ? 10 : 0;
  const tryOverload = b.tries > 6 ? (b.tries - 6) * 12 : 0;

  return (
    b.tries * 6 +
    b.conversions * 4 -
    b.penalties * 4 -
    b.dropGoals +
    realisticConv +
    trySweetSpot -
    tryOverload
  );
}

/**
 * Decompose a valid RL score into tries, conversions, penalties, and drop goals.
 * Prefers try-heavy breakdowns over penalty-heavy ones.
 */
export function decomposeRLScore(score: number): ScoreBreakdown {
  const dropGoalOptions = scoreHasDropGoal(score) ? [1] : [0];
  let best: ScoreBreakdown | null = null;

  for (const dropGoals of dropGoalOptions) {
    const base = score - dropGoals;
    if (base < 0) continue;

    for (let tries = 0; tries <= 16; tries++) {
      for (let conversions = 0; conversions <= tries; conversions++) {
        const fromTriesAndConv = tries * 4 + conversions * 2;
        if (fromTriesAndConv > base) continue;

        const remainder = base - fromTriesAndConv;
        if (remainder % 2 !== 0) continue;

        const penalties = remainder / 2;
        if (penalties > 8) continue;

        const candidate: ScoreBreakdown = {
          tries,
          conversions,
          penalties,
          dropGoals,
          points: score,
        };

        if (
          !best ||
          breakdownPreference(candidate) > breakdownPreference(best)
        ) {
          best = candidate;
        }
      }
    }
  }

  if (best) return best;

  return {
    tries: Math.floor(score / 4),
    conversions: 0,
    penalties: 0,
    dropGoals: score % 2,
    points: score,
  };
}
