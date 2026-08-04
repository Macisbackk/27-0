import { getPlayableClubNames, isPlayableClub } from "../clubs/super-league-display";
import {
  getChampionshipClubByName,
  isChampionshipClubName,
} from "../clubs/championship-clubs";

/** Base strength tiers for playable Super League clubs only. */
const PLAYABLE_CLUB_BASE_STRENGTH: Record<string, number> = {
  "Wigan Warriors": 84,
  "St Helens": 83,
  "Leeds Rhinos": 81,
  "Warrington Wolves": 80,
  "Hull KR": 79,
  "Catalans Dragons": 78,
  "Hull FC": 76,
  "Toulouse Olympique": 76,
  "Leigh Leopards": 75,
  "York Knights": 74,
  "Huddersfield Giants": 73,
  "Castleford Tigers": 70,
  "Bradford Bulls": 74,
  "Wakefield Trinity": 66,
};

/**
 * Championship raw baseStrength (~54–74) overlaps Super League (~66–84).
 * Without a tier offset, cup / attendance code treated every non-playable club
 * as a flat 70 — so Championship sides played as Super League peers.
 * Offset keeps relative Champ ordering while sitting below weak SL (~66).
 */
export const CHAMPIONSHIP_STRENGTH_TIER_OFFSET = 14;

/** Map a Championship club onto the shared club-strength scale used by cup AI. */
export function getChampionshipCupBaseStrength(clubName: string): number {
  const champ = getChampionshipClubByName(clubName);
  const raw = champ?.baseStrength ?? 62;
  return Math.max(
    40,
    Math.min(62, raw - CHAMPIONSHIP_STRENGTH_TIER_OFFSET)
  );
}

export function getClubBaseStrength(club: string): number {
  if (isPlayableClub(club)) {
    return PLAYABLE_CLUB_BASE_STRENGTH[club] ?? 70;
  }
  if (isChampionshipClubName(club)) {
    return getChampionshipCupBaseStrength(club);
  }
  return 70;
}

export function getClubStrength(club: string, rng: () => number): number {
  const base = getClubBaseStrength(club);
  // Championship sides have less match-to-match variance than SL peers.
  const jitter = isChampionshipClubName(club) ? 5 : 8;
  return base + (rng() - 0.5) * jitter;
}

/** Playable clubs sorted by base strength (weakest first). */
export function getPlayableClubsByStrength(): string[] {
  return [...getPlayableClubNames()].sort(
    (a, b) => getClubBaseStrength(a) - getClubBaseStrength(b)
  );
}
