/**
 * Canonical Manager Mode club reputation (1–5 stars).
 * Single source for club select, board expectations, WCC season-one eligibility.
 * Do not derive permanent reputation from in-season squad OVR.
 */

export type ClubStarRating = 1 | 2 | 3 | 4 | 5;

export interface ClubReputation {
  clubId: string;
  clubName: string;
  stars: ClubStarRating;
}

/**
 * Fixed starting reputation for every Manager-selectable Super League club.
 * Schema version bumps when these values change intentionally.
 */
export const CLUB_REPUTATION_SCHEMA_VERSION = 2;

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

export function getClubReputationStars(
  clubName: string
): ClubStarRating | null {
  const stars = CLUB_REPUTATION_BY_NAME[clubName];
  return stars ?? null;
}

export function listClubReputations(): ClubReputation[] {
  return Object.entries(CLUB_REPUTATION_BY_NAME).map(([clubName, stars]) => ({
    clubId: clubName.toLowerCase().replace(/\s+/g, "-"),
    clubName,
    stars,
  }));
}
