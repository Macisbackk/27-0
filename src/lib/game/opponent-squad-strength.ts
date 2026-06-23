import seedrandom from "seedrandom";
import { resolveCanonicalClubName } from "../clubs/club-match";
import { CURRENT_SEASON_YEAR } from "../play-links";
import { getPlayerById } from "../players";
import { getCurrentSquadPlayerIds } from "../players/era-teams";
import { getPlayersForClub } from "./player-pool-eligibility";
import { getClubBaseStrength } from "./club-strength";
import {
  getRawPlayersForTeamYearPool,
  getTeamYearPool,
} from "./team-year-pools";
import type { Player } from "../types";

export interface OpponentPoolOptions {
  currentSeasonOnly?: boolean;
}

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

/** 2026 team-year pool only — used in Current Mode and Current Challenge Cup. */
export function getCurrentSeasonOpponentPool(club: string): Player[] {
  const canonical = resolveCanonicalClubName(club);
  const pool = getTeamYearPool(canonical, CURRENT_SEASON_YEAR);
  if (pool) {
    const roster = getRawPlayersForTeamYearPool(pool);
    if (roster.length >= 13) return roster;
  }

  return getCurrentSquadPlayerIds(canonical)
    .map((id) => getPlayerById(id))
    .filter((p): p is Player => !!p);
}

/** Opponent pool: current squad first, then wider club history — not legends-only stacking. */
export function getOpponentClubPool(
  club: string,
  options: OpponentPoolOptions = {}
): Player[] {
  if (options.currentSeasonOnly) {
    return getCurrentSeasonOpponentPool(club);
  }

  const canonical = resolveCanonicalClubName(club);
  const full = getPlayersForClub(canonical);
  const currentIds = getCurrentSquadPlayerIds(canonical);
  if (currentIds.length < 13) return full;

  const currentSet = new Set(currentIds);
  const current = currentIds
    .map((id) => getPlayerById(id))
    .filter((p): p is Player => !!p);
  const rest = full.filter((p) => !currentSet.has(p.id));
  return [...current, ...rest];
}

function pickWeightedClubSquad(
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
      (sum, player) => sum + 1 + Math.max(0, (player.peakRating - 74) * 0.01),
      0
    );
    let roll = rng() * totalWeight;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= 1 + Math.max(0, (remaining[i]!.peakRating - 74) * 0.01);
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

/** Uniform random XIII — weaker average squads, more variety. */
export function pickUniformClubSquad(
  pool: Player[],
  rng: () => number,
  size = SQUAD_SIZE
): Player[] {
  if (pool.length === 0) return [];
  return fisherYatesShuffle(pool, rng).slice(0, Math.min(size, pool.length));
}

/**
 * Random squad from eligible club pool with mild rating weighting (not top-player stacking).
 */
export function pickRandomClubSquad(
  pool: Player[],
  rng: () => number,
  size = SQUAD_SIZE
): Player[] {
  return pickWeightedClubSquad(pool, rng, size);
}

function averageRating(squad: Player[]): number {
  if (squad.length === 0) return 72;
  return (
    squad.reduce((sum, p) => sum + p.peakRating, 0) / Math.max(squad.length, 1)
  );
}

/**
 * Build opponent strength from a randomly selected squad blended with club tier.
 */
export function getGeneratedClubSquadStrength(
  club: string,
  seed: string,
  salt = "season",
  options: OpponentPoolOptions = {}
): number {
  const key = `${cacheKey(seed, club)}::${options.currentSeasonOnly ? "current" : "all"}`;
  if (salt === "season" && seasonStrengthCache.has(key)) {
    return seasonStrengthCache.get(key)!;
  }

  const canonical = resolveCanonicalClubName(club);
  const pool = getOpponentClubPool(canonical, options);
  if (pool.length === 0) return getClubBaseStrength(canonical);

  const rng = seedrandom(`${seed}-${salt}-${canonical}`);
  const styleRoll = rng();
  const squad =
    styleRoll < 0.4
      ? pickUniformClubSquad(pool, rng, SQUAD_SIZE)
      : styleRoll < 0.75
        ? pickWeightedClubSquad(pool, rng, SQUAD_SIZE)
        : pickWeightedClubSquad(
            fisherYatesShuffle(pool, rng).slice(0, Math.min(40, pool.length)),
            rng,
            SQUAD_SIZE
          );

  const rawAvg = averageRating(squad);
  const baseTier = getClubBaseStrength(canonical);
  const strength = Math.round(
    (rawAvg * 0.35 + baseTier * 0.65 + (rng() - 0.5) * 2.5) * 10
  ) / 10;

  if (salt === "season") {
    seasonStrengthCache.set(key, strength);
  }
  return strength;
}

export function getGeneratedClubSquadPlayers(
  club: string,
  seed: string,
  salt = "season",
  options: OpponentPoolOptions = {}
): Player[] {
  const canonical = resolveCanonicalClubName(club);
  const pool = getOpponentClubPool(canonical, options);
  if (pool.length === 0) return [];
  const rng = seedrandom(`${seed}-${salt}-squad-${canonical}`);
  const styleRoll = rng();
  if (styleRoll < 0.4) {
    return pickUniformClubSquad(pool, rng, SQUAD_SIZE);
  }
  return pickWeightedClubSquad(pool, rng, SQUAD_SIZE);
}

export function clearSeasonSquadStrengthCache(): void {
  seasonStrengthCache.clear();
}

/** Match-level strength with small fixture variance. */
export function getMatchClubStrength(
  club: string,
  seed: string,
  round: number,
  home: boolean,
  options: OpponentPoolOptions = {}
): number {
  const base = getGeneratedClubSquadStrength(club, seed, "season", options);
  const rng = seedrandom(`${seed}-match-${round}-${club}`);
  return base + (home ? 1.5 : 0) + (rng() - 0.5) * 4;
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
