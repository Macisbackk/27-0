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

/**
 * Winning margin in points. Heavily reduced weight on 2pt (one kick) so
 * scorelines like 22–20 are not over-produced by “winner = loser + 2” fixes.
 */
export function pickWinningMargin(rng: () => number): number {
  const roll = rng();
  if (roll < 0.1) return 2;
  if (roll < 0.28) return 4;
  if (roll < 0.48) return 6;
  if (roll < 0.62) return 8;
  if (roll < 0.73) return 10;
  if (roll < 0.82) return 12;
  if (roll < 0.89) return 14;
  if (roll < 0.94) return 16;
  if (roll < 0.97) return 18;
  return 20 + Math.floor(rng() * 5) * 2;
}

/** Raise the winner so they lead by a realistic margin (never a flat +2 only). */
export function ensureScoreAhead(
  winnerScore: number,
  loserScore: number,
  rng: () => number,
  allowDropGoal = false
): number {
  const snappedWinner = snapToRLScore(winnerScore, allowDropGoal);
  const snappedLoser = snapToRLScore(loserScore, false);
  if (snappedWinner > snappedLoser) return snappedWinner;
  return snapToRLScore(snappedLoser + pickWinningMargin(rng), allowDropGoal);
}

/**
 * Pick a correlated winner/loser pair inside the given bounds.
 * Loser is chosen first, then a realistic margin is added — avoids independent
 * rolls that collide and then collapse onto the same +2 scorelines.
 */
export function pickDecisiveScorePair(
  winnerMin: number,
  winnerMax: number,
  loserMin: number,
  loserMax: number,
  rng: () => number,
  options: ScorePickContext = {}
): { winner: number; loser: number } {
  const allowDropGoal = options.allowDropGoal ?? false;
  let loser = pickRLScore(loserMin, loserMax, rng, { allowDropGoal: false });
  let margin = pickWinningMargin(rng);
  let winner = snapToRLScore(loser + margin, allowDropGoal);

  if (winner < winnerMin) {
    winner = pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal });
    const minMargin = Math.max(2, winner - loserMax);
    const maxMargin = Math.max(minMargin, winner - loserMin);
    margin = Math.min(maxMargin, Math.max(minMargin, pickWinningMargin(rng)));
    margin = Math.max(2, Math.round(margin / 2) * 2);
    loser = snapToRLScore(
      Math.max(loserMin, Math.min(loserMax, winner - margin)),
      false
    );
  } else if (winner > winnerMax + 6) {
    // Soft-cap runaway winners: re-anchor inside the intended band.
    winner = pickRLScore(winnerMin, winnerMax, rng, { allowDropGoal });
    const minMargin = Math.max(2, winner - loserMax);
    const maxMargin = Math.max(minMargin, winner - loserMin);
    margin = Math.min(maxMargin, Math.max(minMargin, pickWinningMargin(rng)));
    margin = Math.max(2, Math.round(margin / 2) * 2);
    loser = snapToRLScore(
      Math.max(loserMin, Math.min(loserMax, winner - margin)),
      false
    );
  }

  if (loser >= winner) {
    winner = snapToRLScore(loser + Math.max(4, pickWinningMargin(rng)), allowDropGoal);
  }

  return { winner, loser };
}

/**
 * Pick a scoreline pair that may finish level (regulation draw).
 * With `drawChance` probability, returns an equal score for both sides
 * (a realistic single RL total). Otherwise behaves like `pickDecisiveScorePair`.
 * Use only for competitions whose resolution rules allow a draw
 * (see `getMatchResolutionRules` — never for knockout ties).
 */
export function pickScorePairAllowingDraw(
  winnerMin: number,
  winnerMax: number,
  loserMin: number,
  loserMax: number,
  rng: () => number,
  options: ScorePickContext & { drawChance?: number } = {}
): { winner: number; loser: number; isDraw: boolean } {
  const drawChance = options.drawChance ?? 0.1;
  if (rng() < drawChance) {
    const allowDropGoal = options.allowDropGoal ?? false;
    const level = pickRLScore(
      Math.max(loserMin, Math.round(winnerMin * 0.6)),
      Math.round((winnerMax + loserMax) / 2),
      rng,
      { allowDropGoal: false }
    );
    const snapped = snapToRLScore(level, allowDropGoal);
    return { winner: snapped, loser: snapped, isDraw: true };
  }
  const pair = pickDecisiveScorePair(
    winnerMin,
    winnerMax,
    loserMin,
    loserMax,
    rng,
    options
  );
  return { ...pair, isDraw: false };
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
