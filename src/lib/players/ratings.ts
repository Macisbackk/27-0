import type { PlayerCategory, Position } from "../types";

/**
 * Gameplay ratings for Current & Historic are stored 80–99
 * (see rating-floors.ts). Championship uses a separate 70–89 scale and
 * must not pass through this compressor.
 */
export function compressPeakRating(
  rawRating: number,
  _category: PlayerCategory
): number {
  return Math.max(80, Math.min(99, Math.round(rawRating)));
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
  // Championship-scale ratings (70–79) — cheaper than Super League floors.
  if (rating >= 70) return valueInBand(rating, 70, 79, 12_000, 90_000);
  return valueInBand(rating, 60, 69, 8_000, 12_000);
}

/** Small position premiums — kept within ±5% so rating order is preserved. */
const POSITION_VALUE_MODIFIER: Partial<Record<Position, number>> = {
  STAND_OFF: 1.04,
  SCRUM_HALF: 1.03,
  FULLBACK: 1.02,
  CENTRE: 1.01,
  HOOKER: 0.99,
  PROP: 0.98,
  SECOND_ROW: 0.98,
};

const CATEGORY_VALUE_MODIFIER: Record<PlayerCategory, number> = {
  current: 1.02,
  historic: 0.99,
  legend: 1.0,
};

/**
 * Gameplay transfer value from peak rating with minor position/status variation.
 * Higher rating always maps to a higher base band; modifiers cannot invert peers
 * separated by three or more rating points.
 */
export function computePlayerValue(
  peakRating: number,
  position: Position,
  category: PlayerCategory
): number {
  const base = ratingToValue(peakRating);
  const positionMod = POSITION_VALUE_MODIFIER[position] ?? 1;
  const categoryMod = CATEGORY_VALUE_MODIFIER[category] ?? 1;
  const adjusted = base * positionMod * categoryMod;
  const rounded = Math.round(adjusted / 1_000) * 1_000;

  const floor = ratingToValue(
    peakRating >= 80
      ? Math.max(80, peakRating - 1)
      : Math.max(70, peakRating - 1)
  );
  const ceiling = ratingToValue(Math.min(99, peakRating + 1));
  return Math.max(floor, Math.min(ceiling, rounded));
}

/** Keep stored value aligned when peak rating, position, or category changes. */
export function syncPlayerValueFromRating<
  T extends {
    peakRating: number;
    position: Position;
    category: PlayerCategory;
    value: number;
  },
>(player: T): T {
  const value = computePlayerValue(
    player.peakRating,
    player.position,
    player.category
  );
  return player.value === value ? player : { ...player, value };
}

export function getValueTier(rating: number): string {
  if (rating >= 97) return "Generational";
  if (rating >= 94) return "Elite Star";
  if (rating >= 90) return "Top Tier";
  if (rating >= 86) return "Strong Starter";
  if (rating >= 83) return "Professional";
  return "Fringe / Development";
}
