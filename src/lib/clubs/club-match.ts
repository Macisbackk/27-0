import { getClubByName } from "../clubs";

/**
 * Daily-challenge clone labels use "Club (1)"…"Club (13)" so the league
 * table can list fourteen sides while every opponent is still that club.
 */
export function stripDailyChallengeCloneLabel(team: string): string {
  return team.replace(/ \(\d+\)$/, "").trim();
}

export function resolveCanonicalClubName(club: string): string {
  const base = stripDailyChallengeCloneLabel(club);
  return getClubByName(base)?.name ?? base;
}

export function clubsMatch(playerClub: string, targetClub: string): boolean {
  const a = resolveCanonicalClubName(playerClub);
  const b = resolveCanonicalClubName(targetClub);
  return a === b;
}
