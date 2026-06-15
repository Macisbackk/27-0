/** Shared rating-gap score scaling for match simulation. */

export interface WinnerLoserScoreBounds {
  winnerMin: number;
  winnerMax: number;
  loserMin: number;
  loserMax: number;
}

function clampGap(gap: number): number {
  return Math.max(0, Math.round(gap * 10) / 10);
}

/**
 * Pick win/loss score bounds from absolute rating gap (favourite perspective).
 * Gap tiers: 0–5 normal, 6–10 raised ceiling, 11–15 blowout chance, 16+ rare 60s–70s.
 */
export function getWinnerLoserScoreBounds(
  ratingGap: number,
  rng: () => number
): WinnerLoserScoreBounds {
  const gap = clampGap(Math.abs(ratingGap));

  if (gap <= 5) {
    return { winnerMin: 14, winnerMax: 42, loserMin: 0, loserMax: 28 };
  }

  if (gap <= 10) {
    return { winnerMin: 22, winnerMax: 48, loserMin: 0, loserMax: 24 };
  }

  if (gap <= 15) {
    const mega = rng() < 0.08;
    return {
      winnerMin: mega ? 52 : 36,
      winnerMax: mega ? 68 : 54,
      loserMin: 0,
      loserMax: mega ? 16 : 22,
    };
  }

  const elite = rng() < 0.14;
  const strong = !elite && rng() < 0.42;
  if (elite) {
    return { winnerMin: 60, winnerMax: 76, loserMin: 0, loserMax: 14 };
  }
  if (strong) {
    return { winnerMin: 44, winnerMax: 64, loserMin: 0, loserMax: 18 };
  }
  return { winnerMin: 34, winnerMax: 52, loserMin: 0, loserMax: 20 };
}

/** Bounds for the user's team in generateScoreline (profile-aware). */
export function getBlowoutWinRange(
  ratingGap: number,
  profileWinMin: number,
  profileWinMax: number,
  rng: () => number
): { min: number; max: number } {
  const gap = clampGap(Math.abs(ratingGap));

  if (gap <= 5) {
    return {
      min: Math.max(profileWinMin, 38),
      max: Math.min(profileWinMax, 58),
    };
  }
  if (gap <= 10) {
    return {
      min: Math.max(profileWinMin, 40),
      max: Math.min(54, profileWinMax + 4),
    };
  }
  if (gap <= 15) {
    const mega = rng() < 0.1;
    return mega
      ? { min: 52, max: 66 }
      : { min: 42, max: 56 };
  }

  const elite = rng() < 0.12;
  if (elite) return { min: 60, max: 76 };
  if (rng() < 0.4) return { min: 48, max: 64 };
  return { min: 40, max: 54 };
}

export function getBlowoutLossCap(
  ratingGap: number,
  profileAgainstMax: number,
  rng: () => number
): number {
  const gap = clampGap(Math.abs(ratingGap));
  if (gap >= 16) return Math.min(12, profileAgainstMax);
  if (gap >= 11) return Math.min(16, profileAgainstMax);
  if (gap >= 6) return Math.min(20, profileAgainstMax);
  return Math.min(14, profileAgainstMax);
}
