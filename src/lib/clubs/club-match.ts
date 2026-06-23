import { getClubByName } from "../clubs";

export function resolveCanonicalClubName(club: string): string {
  return getClubByName(club)?.name ?? club;
}

export function clubsMatch(playerClub: string, targetClub: string): boolean {
  const a = resolveCanonicalClubName(playerClub);
  const b = resolveCanonicalClubName(targetClub);
  return a === b;
}
