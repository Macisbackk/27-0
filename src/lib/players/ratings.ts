import type { PlayerCategory } from "../types";

/**
 * Gameplay ratings are stored 75–99 in the database.
 * 75–79 lower squad · 80–84 regulars · 85–89 strong SL
 * 90–94 elite · 95–99 all-time greats / legends
 */
export function compressPeakRating(
  rawRating: number,
  _category: PlayerCategory
): number {
  return Math.max(75, Math.min(99, Math.round(rawRating)));
}

function valueInBand(
  rating: number,
  ratingMin: number,
  ratingMax: number,
  valueMin: number,
  valueMax: number
): number {
  const t = Math.max(
    0,
    Math.min(1, (rating - ratingMin) / (ratingMax - ratingMin))
  );
  const raw = valueMin + t * (valueMax - valueMin);
  return Math.round(raw / 1_000) * 1_000;
}

export function ratingToValue(rating: number): number {
  if (rating >= 95) return valueInBand(rating, 95, 99, 500_000, 750_000);
  if (rating >= 90) return valueInBand(rating, 90, 94, 250_000, 500_000);
  if (rating >= 85) return valueInBand(rating, 85, 89, 150_000, 280_000);
  if (rating >= 80) return valueInBand(rating, 80, 84, 90_000, 180_000);
  return valueInBand(rating, 75, 79, 45_000, 100_000);
}

export function getValueTier(rating: number): string {
  if (rating >= 97) return "Generational";
  if (rating >= 94) return "Elite Star";
  if (rating >= 90) return "Top Tier";
  if (rating >= 85) return "Strong Starter";
  if (rating >= 80) return "Professional";
  return "Squad Player";
}
