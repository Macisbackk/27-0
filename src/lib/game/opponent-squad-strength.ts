import seedrandom from "seedrandom";
import { resolveCanonicalClubName } from "../clubs/club-match";
import { getPlayersForClub } from "./player-pool-eligibility";
import type { Player } from "../types";

const SQUAD_SIZE = 13;

/** Per-club generated squad strength cache for a season seed. */
const seasonStrengthCache = new Map<string, number>();

function cacheKey(seed: string, club: string): string {
  return `${seed}::${resolveCanonicalClubName(club)}`;
}

function fisherYatesShuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Random squad from eligible club pool with mild rating weighting (not top-player stacking).
 */
export function pickRandomClubSquad(
  pool: Player[],
  rng: () => number,
  size = SQUAD_SIZE
): Player[] {
  if (pool.length === 0) return [];
  const target = Math.min(size, pool.length);
  const picks: Player[] = [];
  const remaining = [...pool];

  while (picks.length < target && remaining.length > 0) {
    const totalWeight = remaining.reduce(
      (sum, player) => sum + 1 + Math.max(0, (player.peakRating - 72) * 0.02),
      0
    );
    let roll = rng() * totalWeight;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= 1 + Math.max(0, (remaining[i]!.peakRating - 72) * 0.02);
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picks.push(remaining[index]!);
    remaining.splice(index, 1);
  }

  return picks;
}

/**
 * Build opponent strength from a randomly selected squad — not fixed 2026 base ratings.
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
  const squad = pickRandomClubSquad(pool, rng, SQUAD_SIZE);

  const avg =
    squad.reduce((sum, p) => sum + p.peakRating, 0) / Math.max(squad.length, 1);
  const strength = Math.round((avg + (rng() - 0.5) * 4) * 10) / 10;

  if (salt === "season") {
    seasonStrengthCache.set(key, strength);
  }
  return strength;
}

export function getGeneratedClubSquadPlayers(
  club: string,
  seed: string,
  salt = "season"
): Player[] {
  const canonical = resolveCanonicalClubName(club);
  const pool = getPlayersForClub(canonical);
  if (pool.length === 0) return [];
  const rng = seedrandom(`${seed}-${salt}-squad-${canonical}`);
  return pickRandomClubSquad(pool, rng, SQUAD_SIZE);
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

/** Sample report: average generated squad rating per club for a season seed. */
export function sampleOpponentSquadRatingsByClub(
  clubs: string[],
  seed: string
): Record<string, number> {
  clearSeasonSquadStrengthCache();
  const report: Record<string, number> = {};
  for (const club of clubs) {
    report[club] = getGeneratedClubSquadStrength(club, seed, "season");
  }
  clearSeasonSquadStrengthCache();
  return report;
}
