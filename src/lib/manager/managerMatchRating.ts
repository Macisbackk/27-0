import type { LiveMatchEvent } from "./types";

export interface MatchRatingContribution {
  label: string;
  delta: number;
}

export interface MatchRatingBreakdown {
  rating: number;
  factors: MatchRatingContribution[];
}

function diminishing(count: number, base: number, decay = 0.85): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += base * Math.pow(decay, i);
  }
  return total;
}

/**
 * Match performance rating (1–10), separate from ability (peakRating).
 *
 * Baseline ~6.0 starter / 5.5 bench, then contribution deltas with
 * diminishing returns so multi-try games reach elite bands without
 * a single error wiping out a hat-trick.
 */
export function computeMatchRatingFromEvents(params: {
  playerId: string;
  events: LiveMatchEvent[];
  won: boolean;
  isStarter: boolean;
  wasMotm: boolean;
  /** Fallback from scoring detail when events lack playerIds. */
  tries?: number;
  conversions?: number;
  penalties?: number;
  dropGoals?: number;
}): number {
  return diagnoseMatchRating(params).rating;
}

export function diagnoseMatchRating(params: {
  playerId: string;
  events: LiveMatchEvent[];
  won: boolean;
  isStarter: boolean;
  wasMotm: boolean;
  tries?: number;
  conversions?: number;
  penalties?: number;
  dropGoals?: number;
}): MatchRatingBreakdown {
  const {
    playerId,
    events,
    won,
    isStarter,
    wasMotm,
    tries: triesFallback = 0,
    conversions: convFallback = 0,
    penalties: penFallback = 0,
    dropGoals: dropFallback = 0,
  } = params;

  const factors: MatchRatingContribution[] = [];
  let rating = isStarter ? 6.0 : 5.5;
  factors.push({
    label: isStarter ? "Starter baseline" : "Bench baseline",
    delta: rating,
  });

  let tryCount = 0;
  let conversionCount = 0;
  let penaltyCount = 0;
  let dropCount = 0;
  let lineBreaks = 0;
  let trySavers = 0;
  let fortyTwenties = 0;
  let errors = 0;
  let sinBins = 0;
  let involvement = 0;

  for (const event of events) {
    const isPlayer = event.playerId === playerId;
    const isKicker = event.kickerId === playerId;
    if (!isPlayer && !isKicker) continue;
    involvement += 1;

    switch (event.type) {
      case "try":
        if (isPlayer) tryCount += 1;
        break;
      case "conversion":
      case "goal":
        if (isKicker || isPlayer) conversionCount += 1;
        break;
      case "penalty_goal":
      case "penalty":
        if (isKicker || isPlayer) penaltyCount += 1;
        break;
      case "drop_goal":
        if (isPlayer || isKicker) dropCount += 1;
        break;
      case "line_break":
      case "big_break":
        if (isPlayer) lineBreaks += 1;
        break;
      case "try_saver":
        if (isPlayer) trySavers += 1;
        break;
      case "forty_twenty":
        if (isPlayer) fortyTwenties += 1;
        break;
      case "knock_on":
      case "forward_pass":
      case "forced_error":
        if (isPlayer) errors += 1;
        break;
      case "sin_bin":
        if (isPlayer) sinBins += 1;
        break;
      case "missed_conversion":
      case "missed_drop_goal":
        if (isKicker || isPlayer) {
          rating -= 0.15;
          factors.push({ label: "Missed kick", delta: -0.15 });
        }
        break;
      default:
        break;
    }
  }

  // Prefer event counts; fall back to scoring detail when events lack ids.
  if (tryCount === 0 && triesFallback > 0) tryCount = triesFallback;
  if (conversionCount === 0 && convFallback > 0) conversionCount = convFallback;
  if (penaltyCount === 0 && penFallback > 0) penaltyCount = penFallback;
  if (dropCount === 0 && dropFallback > 0) dropCount = dropFallback;

  const tryDelta = diminishing(tryCount, 1.35, 0.82);
  if (tryDelta !== 0) {
    rating += tryDelta;
    factors.push({ label: `Tries ×${tryCount}`, delta: tryDelta });
  }

  const kickDelta =
    diminishing(conversionCount, 0.4, 0.9) +
    diminishing(penaltyCount, 0.45, 0.9) +
    diminishing(dropCount, 0.65, 0.85);
  if (kickDelta !== 0) {
    rating += kickDelta;
    factors.push({ label: "Kicking", delta: kickDelta });
  }

  const breakDelta = diminishing(lineBreaks, 0.45, 0.88);
  if (breakDelta !== 0) {
    rating += breakDelta;
    factors.push({ label: `Breaks ×${lineBreaks}`, delta: breakDelta });
  }

  const saveDelta = diminishing(trySavers, 0.55, 0.85);
  if (saveDelta !== 0) {
    rating += saveDelta;
    factors.push({ label: `Try savers ×${trySavers}`, delta: saveDelta });
  }

  const kickTerritory = diminishing(fortyTwenties, 0.35, 0.9);
  if (kickTerritory !== 0) {
    rating += kickTerritory;
    factors.push({ label: "40/20", delta: kickTerritory });
  }

  // Soft error cap: never erase more than ~1.2 from a multi-try night unless sin-binned.
  const rawError = diminishing(errors, 0.3, 0.92);
  const errorCap = tryCount >= 2 ? 1.0 : tryCount === 1 ? 1.4 : 2.2;
  const errorDelta = -Math.min(rawError, errorCap);
  if (errorDelta !== 0) {
    rating += errorDelta;
    factors.push({ label: `Errors ×${errors}`, delta: errorDelta });
  }

  if (sinBins > 0) {
    const sinDelta = -1.4 * sinBins;
    rating += sinDelta;
    factors.push({ label: `Sin bin ×${sinBins}`, delta: sinDelta });
  }

  if (isStarter && involvement === 0 && tryCount === 0 && conversionCount === 0) {
    rating -= 0.35;
    factors.push({ label: "Very low involvement", delta: -0.35 });
  }

  if (won) {
    rating += 0.25;
    factors.push({ label: "Win bonus", delta: 0.25 });
  } else {
    rating -= 0.1;
    factors.push({ label: "Loss", delta: -0.1 });
  }

  if (wasMotm) {
    rating += 0.5;
    factors.push({ label: "Player of the Match", delta: 0.5 });
  }

  // Exceptional floors: multi-try performances should land high even after soft errors.
  if (tryCount >= 3) rating = Math.max(rating, 9.0);
  else if (tryCount === 2) rating = Math.max(rating, 8.2);
  else if (tryCount === 1) rating = Math.max(rating, 7.2);

  const clamped = Math.round(Math.min(10, Math.max(1, rating)) * 10) / 10;
  if (clamped !== rating) {
    factors.push({ label: "Clamp", delta: clamped - rating });
  }

  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[match-rating] ${playerId} → ${clamped}`,
      factors.map((f) => `${f.label}:${f.delta >= 0 ? "+" : ""}${f.delta.toFixed(2)}`).join(" | ")
    );
  }

  return { rating: clamped, factors };
}

export function formatAverageRating(averageRating: number | undefined): string {
  if (averageRating == null || Number.isNaN(averageRating)) return "—";
  return `${averageRating.toFixed(1)}/10`;
}

/** Convert a 1–10 match rating into a 1–99 form delta (ability stays separate). */
export function formDeltaFromMatchRating(matchRating: number): number {
  // 6.5 ≈ neutral; 10 → +14; 4 → −10
  return Math.round((matchRating - 6.5) * 4);
}
