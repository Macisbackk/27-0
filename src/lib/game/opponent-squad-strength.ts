import seedrandom from "seedrandom";
import { resolveCanonicalClubName } from "../clubs/club-match";
import { getPlayersForClub } from "./player-pool-eligibility";

const SQUAD_SIZE = 13;

/** Per-club generated squad strength cache for a season seed. */
const seasonStrengthCache = new Map<string, number>();

function cacheKey(seed: string, club: string): string {
  return `${seed}::${resolveCanonicalClubName(club)}`;
}

/**
 * Build a realistic opponent strength from a random Super League player pool
 * (current + historic + legend) — not fixed 2026 base ratings.
 */
export function getGeneratedClubSquadStrength(
  club: string,
  seed: string,
  salt = "season"
): number {
  const key = cacheKey(seed, club);
  if (salt === "season" && seasonStrengthCache.has(key)) {
    return seasonStrengthCache.get(key)!;
  }

  const canonical = resolveCanonicalClubName(club);
  const pool = getPlayersForClub(canonical);
  if (pool.length === 0) return 72;

  const rng = seedrandom(`${seed}-${salt}-${canonical}`);
  const byRating = [...pool].sort((a, b) => b.peakRating - a.peakRating);
  const picks = new Set<string>();

  while (picks.size < Math.min(SQUAD_SIZE, pool.length)) {
    const roll = rng();
    const index =
      roll < 0.55
        ? Math.floor(rng() * Math.min(24, byRating.length))
        : Math.floor(rng() * byRating.length);
    const player = byRating[Math.min(index, byRating.length - 1)];
    if (player) picks.add(player.id);
  }

  const squad = [...picks]
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const avg =
    squad.reduce((sum, p) => sum + p.peakRating, 0) / Math.max(squad.length, 1);
  const strength = Math.round((avg + (rng() - 0.5) * 3) * 10) / 10;

  if (salt === "season") {
    seasonStrengthCache.set(key, strength);
  }
  return strength;
}

export function clearSeasonSquadStrengthCache(): void {
  seasonStrengthCache.clear();
}

/** Match-level strength with small fixture variance. */
export function getMatchClubStrength(
  club: string,
  seed: string,
  round: number,
  home: boolean
): number {
  const base = getGeneratedClubSquadStrength(club, seed, "season");
  const rng = seedrandom(`${seed}-match-${round}-${club}`);
  return base + (home ? 2 : 0) + (rng() - 0.5) * 5;
}
