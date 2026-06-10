/**
 * Squad quality tiers from average adjusted OVR.
 * Value is optional secondary signal for tie-breaks only.
 */
export function getTeamTier(averageRating: number): string {
  if (averageRating >= 99) return "Immortal XIII";
  if (averageRating >= 96) return "All-Time Greats";
  if (averageRating >= 93) return "Dynasty Squad";
  if (averageRating >= 90) return "Title Favourites";
  if (averageRating >= 87) return "Grand Final Contenders";
  if (averageRating >= 84) return "Playoff Quality";
  if (averageRating >= 81) return "Competitive Squad";
  if (averageRating >= 78) return "Mid-Table Side";
  if (averageRating >= 75) return "Rebuild Squad";
  return "Wooden Spoon Squad";
}

export function formatTeamRatingDisplay(
  rating: number,
  options?: { includeTier?: boolean }
): string {
  const rounded = rating.toFixed(1);
  if (options?.includeTier === false) return rounded;
  return `${rounded} — ${getTeamTier(rating)}`;
}

export function formatNamedTeamRating(
  name: string,
  rating: number,
  value?: number
): string {
  const tier = getTeamTier(rating);
  const base = `${name} — ${rating.toFixed(1)} — ${tier}`;
  if (value === undefined) return base;
  return base;
}

/** Prefer higher rating; break ties with squad value. */
export function compareTeamQuality(
  ratingA: number,
  valueA: number,
  ratingB: number,
  valueB: number
): number {
  if (Math.abs(ratingA - ratingB) >= 0.05) {
    return ratingB - ratingA;
  }
  return valueB - valueA;
}
