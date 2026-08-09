/**
 * Competition / player-type rating floors.
 * Current Super League seniors & Historic: 80.
 * Championship: 70. Reserves and reserve-origin free agents: 65.
 */

export const CURRENT_SENIOR_MIN_RATING = 80;
export const CURRENT_SUPER_LEAGUE_MIN_RATING = CURRENT_SENIOR_MIN_RATING;
export const HISTORIC_MIN_RATING = 80;
export const HISTORIC_PLAYER_MIN_RATING = HISTORIC_MIN_RATING;
export const CHAMPIONSHIP_MIN_RATING = 65;
export const CHAMPIONSHIP_PLAYER_MIN_RATING = CHAMPIONSHIP_MIN_RATING;
export const RESERVE_MIN_RATING = 65;
export const RANDOM_FREE_AGENT_MIN_RATING = 70;

/** Alias — generated reserves (academy/youth) use the same 65 floor as all reserves. */
export const GENERATED_RESERVE_MIN_RATING = RESERVE_MIN_RATING;
/** Alias — reserve-origin free agents use the same 65 floor as reserves. */
export const RESERVE_ORIGIN_FREE_AGENT_MIN_RATING = RESERVE_MIN_RATING;

export const CURRENT_HISTORIC_MAX_RATING = 99;
/**
 * Absolute Championship ceiling (includes researched / transferred SL players).
 * First-season *generated* squads use GENERATED_CHAMPIONSHIP_MAX_RATING instead.
 */
export const CHAMPIONSHIP_PLAYER_MAX_RATING = 89;
/** First-season generated Championship players — clearly below Super League 80+. */
export const GENERATED_CHAMPIONSHIP_MAX_RATING = 78;
export const RESERVE_MAX_RATING = 92;
export const RANDOM_FREE_AGENT_MAX_RATING = 84;

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

/** Clamp a reserve / academy pathway rating. */
export function clampReservePlayerRating(rating: number): number {
  return Math.max(
    RESERVE_MIN_RATING,
    Math.min(RESERVE_MAX_RATING, Math.round(rating))
  );
}

/** Clamp a randomly generated free-agent rating. */
export function clampRandomFreeAgentRating(rating: number): number {
  return Math.max(
    RANDOM_FREE_AGENT_MIN_RATING,
    Math.min(RANDOM_FREE_AGENT_MAX_RATING, Math.round(rating))
  );
}

/**
 * Out-of-position floor: Super League-scale ratings keep 80;
 * Championship-scale ratings (below 80) keep 70; reserve-scale keep 65.
 */
export function outOfPositionRatingFloor(currentRating: number): number {
  if (currentRating >= CURRENT_SUPER_LEAGUE_MIN_RATING) {
    return CURRENT_SUPER_LEAGUE_MIN_RATING;
  }
  if (currentRating < CHAMPIONSHIP_PLAYER_MIN_RATING) {
    return RESERVE_MIN_RATING;
  }
  return CHAMPIONSHIP_PLAYER_MIN_RATING;
}

export type RatingFloorPlayerKind =
  | "historic"
  | "championship"
  | "reserve"
  | "reserve-free-agent"
  | "current-senior";

/** Minimum rating by canonical player category — not by name or array location. */
export function getMinimumRatingForKind(kind: RatingFloorPlayerKind): number {
  switch (kind) {
    case "historic":
      return HISTORIC_MIN_RATING;
    case "championship":
      return CHAMPIONSHIP_MIN_RATING;
    case "reserve":
      return RESERVE_MIN_RATING;
    case "reserve-free-agent":
      return RESERVE_ORIGIN_FREE_AGENT_MIN_RATING;
    case "current-senior":
    default:
      return CURRENT_SENIOR_MIN_RATING;
  }
}
