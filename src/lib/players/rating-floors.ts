/**
 * Competition-specific rating floors.
 * Current Super League & Historic share 80; Championship uses 70.
 * Legends / GOAT remain on the top of the 80–99 Current/Historic scale.
 */

export const CURRENT_SUPER_LEAGUE_MIN_RATING = 80;
export const HISTORIC_PLAYER_MIN_RATING = 80;
export const CHAMPIONSHIP_PLAYER_MIN_RATING = 70;

export const CURRENT_HISTORIC_MAX_RATING = 99;
export const CHAMPIONSHIP_PLAYER_MAX_RATING = 89;

/** Clamp a Current Super League peak rating. */
export function clampCurrentSuperLeagueRating(rating: number): number {
  return Math.max(
    CURRENT_SUPER_LEAGUE_MIN_RATING,
    Math.min(CURRENT_HISTORIC_MAX_RATING, Math.round(rating))
  );
}

/** Clamp a Historic peak rating. */
export function clampHistoricPlayerRating(rating: number): number {
  return Math.max(
    HISTORIC_PLAYER_MIN_RATING,
    Math.min(CURRENT_HISTORIC_MAX_RATING, Math.round(rating))
  );
}

/** Clamp a Championship peak rating (generated or researched). */
export function clampChampionshipPlayerRating(rating: number): number {
  return Math.max(
    CHAMPIONSHIP_PLAYER_MIN_RATING,
    Math.min(CHAMPIONSHIP_PLAYER_MAX_RATING, Math.round(rating))
  );
}

/**
 * Out-of-position floor: Super League-scale ratings keep 80;
 * Championship-scale ratings (below 80) keep 70.
 */
export function outOfPositionRatingFloor(currentRating: number): number {
  return currentRating >= CURRENT_SUPER_LEAGUE_MIN_RATING
    ? CURRENT_SUPER_LEAGUE_MIN_RATING
    : CHAMPIONSHIP_PLAYER_MIN_RATING;
}
