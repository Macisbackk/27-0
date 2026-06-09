import type { PlayerCategory } from "../types";

const INPUT_BOUNDS: Record<PlayerCategory, [number, number]> = {
  current: [66, 93],
  historic: [70, 96],
  legend: [88, 99],
};

const OUTPUT_BOUNDS: Record<PlayerCategory, [number, number]> = {
  current: [70, 91],
  historic: [73, 95],
  legend: [90, 99],
};

function getTier(category: PlayerCategory, rawRating: number): string {
  if (category === "legend") {
    if (rawRating >= 98) return "generational";
    if (rawRating >= 95) return "all-time-great";
    return "legend";
  }
  if (rawRating >= 90) return "elite-star";
  if (rawRating >= 85) return "strong-starter";
  if (rawRating >= 80) return "professional";
  if (rawRating >= 75) return "squad";
  return "depth";
}

/**
 * Map raw database ratings onto the full 70–99 scale.
 * 99 generational · 97–98 all-time greats · 94–96 elite · 90–93 top SL
 * 85–89 strong · 80–84 good pro · 75–79 squad · 70–74 depth
 */
export function compressPeakRating(
  rawRating: number,
  category: PlayerCategory
): number {
  const [inMin, inMax] = INPUT_BOUNDS[category];
  const [outMin, outMax] = OUTPUT_BOUNDS[category];
  const clamped = Math.max(inMin, Math.min(inMax, rawRating));
  const t = (clamped - inMin) / (inMax - inMin);

  let compressed = Math.round(outMin + t * (outMax - outMin));

  if (category === "legend") {
    const tier = getTier(category, rawRating);
    if (tier === "generational") compressed = Math.max(compressed, 97);
    if (tier === "all-time-great") compressed = Math.max(compressed, 94);
    compressed = Math.min(99, compressed);
  } else if (category === "historic") {
    compressed = Math.max(73, Math.min(95, compressed));
  } else {
    compressed = Math.max(70, Math.min(91, compressed));
  }

  return compressed;
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
  if (rating >= 75) return valueInBand(rating, 75, 79, 45_000, 100_000);
  return valueInBand(rating, 70, 74, 20_000, 50_000);
}

export function getValueTier(rating: number): string {
  if (rating >= 97) return "Generational";
  if (rating >= 94) return "Elite Star";
  if (rating >= 90) return "Top Tier";
  if (rating >= 85) return "Strong Starter";
  if (rating >= 80) return "Professional";
  if (rating >= 75) return "Squad Player";
  return "Depth";
}
