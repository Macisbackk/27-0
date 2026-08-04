/**
 * Squad quality tiers from average adjusted OVR (floor-80 scale).
 * Value is optional secondary signal for tie-breaks only.
 */
export function getTeamTier(averageRating: number): string {
  if (averageRating >= 96) return "Immortal XIII";
  if (averageRating >= 94) return "All-Time Greats";
  if (averageRating >= 92) return "Generational Squad";
  if (averageRating >= 90) return "Title Favourites";
  if (averageRating >= 88) return "Grand Final Contenders";
  if (averageRating >= 87) return "Trophy Contenders";
  if (averageRating >= 86) return "Top Six Contender";
  if (averageRating >= 85) return "Competitive Outfit";
  if (averageRating >= 84) return "Dangerous Underdogs";
  if (averageRating >= 83) return "Mid-Table Side";
  if (averageRating >= 82) return "Inconsistent Squad";
  if (averageRating >= 81) return "Rebuild Project";
  if (averageRating >= 80) return "Basement Battlers";
  return "Wooden Spoon Side";
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
