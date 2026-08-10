/**
 * Canonical Manager Mode club reputation.
 * Single source for club select, board expectations, WCC season-one eligibility.
 * Do not derive permanent reputation from in-season squad OVR.
 *
 * Super League and Championship use separate star ladders. Championship stars
 * are capped at 3 and map to a lower absolute prestige than Super League stars
 * of the same count (a Champ 3★ is below an SL 3★).
 */

export type ClubStarRating = 1 | 2 | 3 | 4 | 5;

/** Championship board prestige is intentionally capped below Super League. */
export type ChampionshipStarRating = 1 | 2 | 3;

export type ClubReputationLeague = "super-league" | "championship";

export interface ClubReputation {
  clubId: string;
  clubName: string;
  stars: ClubStarRating;
  league: ClubReputationLeague;
}

/**
 * Fixed starting reputation schema.
 * Bump when SL or Championship star assignments change intentionally.
 */
export const CLUB_REPUTATION_SCHEMA_VERSION = 3;

/**
 * Absolute prestige (1–10) for cross-league comparisons.
 * Championship ceiling is below Super League mid-table.
 */
export const SUPER_LEAGUE_PRESTIGE_BY_STARS: Record<ClubStarRating, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
};

export const CHAMPIONSHIP_PRESTIGE_BY_STARS: Record<
  ChampionshipStarRating,
  number
> = {
  1: 1,
  2: 3,
  3: 5,
};

export const CHAMPIONSHIP_MAX_STARS = 3 as const;
export const SUPER_LEAGUE_MAX_STARS = 5 as const;

/** Club name → stars. Every CURRENT_PLAYABLE_CLUBS entry must appear here. */
export const CLUB_REPUTATION_BY_NAME: Readonly<
  Record<string, ClubStarRating>
> = {
  "Leeds Rhinos": 5,
  "St Helens": 5,
  "Wigan Warriors": 5,
  "Hull KR": 4,
  "Warrington Wolves": 4,
  "Hull FC": 3,
  "Wakefield Trinity": 3,
  "Catalans Dragons": 3,
  "Leigh Leopards": 3,
  "Bradford Bulls": 2,
  "Huddersfield Giants": 2,
  "Castleford Tigers": 2,
  "York Knights": 1,
  "Toulouse Olympique": 1,
};

/**
 * Championship reputation (1–3 only).
 * Audit basis (Aug 2026): club prestige / resources / promotion expectations —
 * not mid-season form alone. Ex-SL and traditional Champ heavyweights sit at 3★;
 * established Champ sides at 2★; former League One / smaller clubs at 1★.
 */
export const CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME: Readonly<
  Record<string, ChampionshipStarRating>
> = {
  // 3★ — Championship elite / promotion favourites
  "Salford RLFC": 3,
  "London Broncos": 3,
  "Widnes Vikings": 3,

  // 2★ — established Championship pack
  "Halifax Panthers": 2,
  "Sheffield Eagles": 2,
  "Oldham RLFC": 2,
  "Doncaster RLFC": 2,
  "Barrow Raiders": 2,
  "Batley Bulldogs": 2,
  "Newcastle Thunder": 2,

  // 1★ — smaller / recently promoted Championship clubs
  "Hunslet RLFC": 1,
  "Whitehaven RLFC": 1,
  "Dewsbury Rams": 1,
  "Swinton Lions": 1,
  "Workington Town": 1,
  "Keighley Cougars": 1,
  "Rochdale Hornets": 1,
  "Midlands Hurricanes": 1,
  "Goole Vikings": 1,
  "North Wales Crusaders": 1,
};

export function getClubReputationStars(
  clubName: string
): ClubStarRating | null {
  const stars = CLUB_REPUTATION_BY_NAME[clubName];
  return stars ?? null;
}

export function getChampionshipClubReputationStars(
  clubName: string
): ChampionshipStarRating | null {
  const stars = CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[clubName];
  return stars ?? null;
}

export function getClubReputationLeague(
  clubName: string
): ClubReputationLeague | null {
  if (CLUB_REPUTATION_BY_NAME[clubName] != null) return "super-league";
  if (CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[clubName] != null) {
    return "championship";
  }
  return null;
}

export function getMaxStarsForLeague(
  league: ClubReputationLeague
): 3 | 5 {
  return league === "championship"
    ? CHAMPIONSHIP_MAX_STARS
    : SUPER_LEAGUE_MAX_STARS;
}

/** Absolute 1–10 prestige for budgets / cross-league comparisons. */
export function getAbsoluteClubPrestige(
  league: ClubReputationLeague,
  stars: number
): number {
  const clamped = Math.max(1, Math.min(5, Math.round(stars)));
  if (league === "championship") {
    const champStars = Math.min(
      CHAMPIONSHIP_MAX_STARS,
      clamped
    ) as ChampionshipStarRating;
    return CHAMPIONSHIP_PRESTIGE_BY_STARS[champStars];
  }
  return SUPER_LEAGUE_PRESTIGE_BY_STARS[clamped as ClubStarRating];
}

export function listClubReputations(): ClubReputation[] {
  const sl = Object.entries(CLUB_REPUTATION_BY_NAME).map(
    ([clubName, stars]) => ({
      clubId: clubName.toLowerCase().replace(/\s+/g, "-"),
      clubName,
      stars,
      league: "super-league" as const,
    })
  );
  const champ = Object.entries(CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME).map(
    ([clubName, stars]) => ({
      clubId: clubName.toLowerCase().replace(/\s+/g, "-"),
      clubName,
      stars: stars as ClubStarRating,
      league: "championship" as const,
    })
  );
  return [...sl, ...champ];
}

/**
 * Fallback when a Championship club is missing from the reputation table.
 * Prefer CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME for playable clubs.
 */
export function championshipStarsFromBaseStrength(
  baseStrength: number
): ChampionshipStarRating {
  if (baseStrength >= 71) return 3;
  if (baseStrength >= 64) return 2;
  return 1;
}
