import { getClubByName } from "../clubs";

/**
 * Daily-challenge clone labels use "Club (1)"…"Club (13)" so the league
 * table can list fourteen sides while every opponent is still that club.
 */
export function stripDailyChallengeCloneLabel(team: string): string {
  return team.replace(/ \(\d+\)$/, "").trim();
}

/**
 * Memoised: the club tables are static, and this runs for every player in the pool on each
 * getPlayersByClub call (dozens per simulated season). Uncached, a Classic season sim took
 * ~1.3s, which the halfway call repeats on the main thread when a plan is picked.
 */
const canonicalClubCache = new Map<string, string>();

export function resolveCanonicalClubName(club: string): string {
  const cached = canonicalClubCache.get(club);
  if (cached !== undefined) return cached;
  const base = stripDailyChallengeCloneLabel(club);
  const resolved = getClubByName(base)?.name ?? base;
  if (canonicalClubCache.size < 5000) canonicalClubCache.set(club, resolved);
  return resolved;
}

export function clubsMatch(playerClub: string, targetClub: string): boolean {
  const a = resolveCanonicalClubName(playerClub);
  const b = resolveCanonicalClubName(targetClub);
  return a === b;
}
