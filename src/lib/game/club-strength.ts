import { getPlayableClubNames, isPlayableClub } from "../clubs/super-league-display";

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
  "Bradford Bulls": 69,
  "Wakefield Trinity": 66,
};

export function getClubBaseStrength(club: string): number {
  if (!isPlayableClub(club)) return 70;
  return PLAYABLE_CLUB_BASE_STRENGTH[club] ?? 70;
}

export function getClubStrength(club: string, rng: () => number): number {
  const base = getClubBaseStrength(club);
  return base + (rng() - 0.5) * 8;
}

/** Playable clubs sorted by base strength (weakest first). */
export function getPlayableClubsByStrength(): string[] {
  return [...getPlayableClubNames()].sort(
    (a, b) => getClubBaseStrength(a) - getClubBaseStrength(b)
  );
}
