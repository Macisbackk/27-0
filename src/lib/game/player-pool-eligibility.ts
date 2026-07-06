import { clubsMatch, resolveCanonicalClubName } from "../clubs/club-match";
import {
  getCurrentPlayableClubNames,
  getEraPlayableClubNames,
  isCurrentPlayableClub,
  isEraPlayableClub,
} from "../clubs/super-league-display";
import {
  CURRENT_PLAYERS,
  HISTORIC_PLAYERS,
  LEGEND_PLAYERS,
  getRecruitablePlayers,
  isAvailableInGame,
} from "../players";
import { isHiddenPlayer } from "../players/goat";
import {
  getAllTeamYearPools,
  getRawPlayersForTeamYearPool,
  getTeamYearPool,
  type TeamYearPool,
} from "./team-year-pools";
import { getTeamsWithYearRosters, getYearsForTeam } from "../players/team-year-rosters";
import { getTeamYearRosterMeta } from "../players/team-year-roster-meta";
import { isSuperLeagueEligiblePlayer } from "../players/super-league-eligibility";
import { getEraClubsWithTeams } from "../players/era-teams";
import type { Player } from "../types";
import { CURRENT_SEASON_YEAR } from "../play-links";

export type SpinPoolVariant = "current" | "era";

/** Current Super League clubs in Normal / Hard / Cup / Fantasy / Draft pools. */
export const CURRENT_PLAYABLE_CLUBS = getCurrentPlayableClubNames() as unknown as readonly [
  string,
  ...string[],
];

export type PlayerPoolMode =
  | "normal"
  | "hard"
  | "fantasy"
  | "draft";

/** Era starting-17 generated cards — excluded from global recruitment pools. */
export function isEraOnlyGeneratedPlayer(player: Player): boolean {
  return player.id.includes("-hist-era-");
}

function isGlobalRecruitmentEligible(player: Player): boolean {
  return (
    !isHiddenPlayer(player) &&
    isAvailableInGame(player) &&
    !isEraOnlyGeneratedPlayer(player) &&
    isSuperLeagueEligiblePlayer(player)
  );
}

/** Global DB pool: current + historic + legends (deduped), no era-only imports. */
export function getGlobalRecruitmentPool(): Player[] {
  return getRecruitablePlayers().filter(
    (player) => !isEraOnlyGeneratedPlayer(player)
  );
}

export function getPlayersForClub(club: string): Player[] {
  const canonical = resolveCanonicalClubName(club);
  return getGlobalRecruitmentPool().filter((player) =>
    clubsMatch(player.club, canonical)
  );
}

/** Current-season club squad for Challenge Cup drafting (2026 team-year roster). */
export function getChallengeCupClubPool(club: string): Player[] {
  const canonical = resolveCanonicalClubName(club);
  const pool = getTeamYearPool(canonical, CURRENT_SEASON_YEAR);
  if (pool) {
    const roster = getRawPlayersForTeamYearPool(pool);
    if (roster.length > 0) return roster;
  }

  return getPlayersForClub(canonical).filter(
    (player) => player.category === "current"
  );
}

export function getNormalModeGlobalPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getHardModeGlobalPool(): Player[] {
  return getNormalModeGlobalPool();
}

export function getChallengeCupPool(clubFilter?: string): Player[] {
  if (clubFilter) {
    return getChallengeCupClubPool(clubFilter);
  }
  return getGlobalRecruitmentPool();
}

export function getFantasyPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getDraftPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getCurrentModeTeamYearPools(): TeamYearPool[] {
  return getAllTeamYearPools().filter((pool) => {
    const meta = getTeamYearRosterMeta(pool.team, pool.year);
    return (
      isCurrentPlayableClub(pool.team) &&
      meta?.playableInNormalSpin === true &&
      meta?.isCurrentSeason === true &&
      pool.year === CURRENT_SEASON_YEAR
    );
  });
}

export function getEraModeTeamYearPools(): TeamYearPool[] {
  return getAllTeamYearPools().filter((pool) => {
    const meta = getTeamYearRosterMeta(pool.team, pool.year);
    return (
      isEraPlayableClub(pool.team) &&
      meta?.playableInEra === true &&
      meta?.isCurrentSeason !== true &&
      pool.year !== CURRENT_SEASON_YEAR
    );
  });
}

export function getTeamYearPoolsForSpinVariant(
  variant: SpinPoolVariant
): TeamYearPool[] {
  return variant === "current"
    ? getCurrentModeTeamYearPools()
    : getEraModeTeamYearPools();
}

/** @deprecated Use getTeamYearPoolsForSpinVariant — historic + 2026 mixed pools. */
export function getNormalModeTeamYearPools(): TeamYearPool[] {
  return getEraModeTeamYearPools();
}

let cachedSpinPools: Partial<Record<SpinPoolVariant, TeamYearPool[]>> = {};

/** Memoised validated spin pools — safe to call before each spin. */
export function getSpinTeamYearPoolsCached(
  variant: SpinPoolVariant = "era"
): TeamYearPool[] {
  if (!cachedSpinPools[variant]) {
    cachedSpinPools[variant] = getTeamYearPoolsForSpinVariant(variant);
  }
  return cachedSpinPools[variant]!;
}

/** @deprecated Use getSpinTeamYearPoolsCached(variant) */
export function getNormalModeTeamYearPoolsCached(): TeamYearPool[] {
  return getSpinTeamYearPoolsCached("era");
}

export function clearSpinTeamYearPoolsCache(): void {
  cachedSpinPools = {};
}

/** @deprecated Use clearSpinTeamYearPoolsCache */
export function clearNormalModeTeamYearPoolsCache(): void {
  clearSpinTeamYearPoolsCache();
}

/** Era spin — uniform weight (2026/current pools excluded from Era Mode). */
export function getEraSpinPoolWeight(_pool: TeamYearPool): number {
  return 1;
}

/** Uniform spin weight for Current Mode (one pool per club). */
export function getCurrentSpinPoolWeight(_pool: TeamYearPool): number {
  return 1;
}

export function getSpinPoolWeight(
  pool: TeamYearPool,
  variant: SpinPoolVariant
): number {
  return variant === "current"
    ? getCurrentSpinPoolWeight(pool)
    : getEraSpinPoolWeight(pool);
}

/**
 * Uniform random team-year pool — each eligible pool has equal probability.
 * Do NOT pick year first (that over-weights lone team-years like Leeds 2015 / Catalans 2007).
 */
export function pickUniformTeamYearPool<T extends TeamYearPool>(
  pools: T[],
  rng: () => number
): T | null {
  if (pools.length === 0) return null;
  return pools[Math.floor(rng() * pools.length)]!;
}

/** @deprecated Use pickUniformTeamYearPool — year-first weighting biases sparse years. */
export function pickWeightedNormalModePool<T extends TeamYearPool>(
  pools: T[],
  rng: () => number
): T | null {
  return pickUniformTeamYearPool(pools, rng);
}

export interface PlayerPoolAudit {
  mode: PlayerPoolMode;
  totalPlayers: number;
  byClub: Record<string, number>;
  byCategory: { current: number; historic: number; legend: number };
  missingClubs: string[];
  lowCountClubs: { club: string; count: number }[];
  eraOnlyExcluded: number;
}

function countByCategory(players: Player[]): PlayerPoolAudit["byCategory"] {
  return {
    current: players.filter((p) => p.category === "current").length,
    historic: players.filter((p) => p.category === "historic").length,
    legend: players.filter((p) => p.category === "legend").length,
  };
}

function auditGlobalPool(
  mode: PlayerPoolMode,
  players: Player[],
  clubList: readonly string[]
): PlayerPoolAudit {
  const byClub: Record<string, number> = {};
  for (const club of clubList) {
    byClub[club] = players.filter((p) => clubsMatch(p.club, club)).length;
  }

  const missingClubs = clubList.filter((club) => (byClub[club] ?? 0) === 0);
  const lowCountClubs = clubList
    .map((club) => ({ club, count: byClub[club] ?? 0 }))
    .filter((row) => row.count > 0 && row.count < 5);

  const recruitableAll = getRecruitablePlayers();
  const eraOnlyExcluded = recruitableAll.filter(isEraOnlyGeneratedPlayer).length;

  return {
    mode,
    totalPlayers: players.length,
    byClub,
    byCategory: countByCategory(players),
    missingClubs: [...missingClubs],
    lowCountClubs,
    eraOnlyExcluded,
  };
}

export function auditNormalModePool(): PlayerPoolAudit {
  const teamYearPlayerIds = new Set<string>();
  for (const pool of getNormalModeTeamYearPools()) {
    for (const id of pool.playerIds) teamYearPlayerIds.add(id);
  }

  const players = getGlobalRecruitmentPool().filter((p) =>
    teamYearPlayerIds.has(p.id)
  );

  const clubsWithRosters = getTeamsWithYearRosters();
  const byClub: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    const years = getYearsForTeam(club);
    const ids = new Set<string>();
    for (const year of years) {
      const pool = getTeamYearPool(club, year);
      if (pool) {
        for (const id of pool.playerIds) ids.add(id);
      }
    }
    byClub[club] = ids.size;
  }

  const missingClubs = clubsWithRosters.filter(
    (club) => (byClub[club] ?? 0) === 0
  );

  return {
    mode: "normal",
    totalPlayers: players.length,
    byClub,
    byCategory: countByCategory(players),
    missingClubs,
    lowCountClubs: CURRENT_PLAYABLE_CLUBS.map((club) => ({
      club,
      count: byClub[club] ?? 0,
    })).filter((row) => row.count > 0 && row.count < 10),
    eraOnlyExcluded: getRecruitablePlayers().filter(isEraOnlyGeneratedPlayer)
      .length,
  };
}

export function auditModePool(mode: PlayerPoolMode): PlayerPoolAudit {
  const clubs = CURRENT_PLAYABLE_CLUBS;
  switch (mode) {
    case "normal":
      return auditNormalModePool();
    case "hard":
      return auditGlobalPool(mode, getHardModeGlobalPool(), clubs);
    case "fantasy":
      return auditGlobalPool(mode, getFantasyPool(), clubs);
    case "draft":
      return auditGlobalPool(mode, getDraftPool(), clubs);
    default:
      return auditGlobalPool(mode, getGlobalRecruitmentPool(), clubs);
  }
}

/** Verify all playable clubs are represented in global recruitment. */
export function getMissingPlayableClubs(players: Player[]): string[] {
  return CURRENT_PLAYABLE_CLUBS.filter(
    (club) => !players.some((p) => clubsMatch(p.club, club))
  );
}

export function assertPlayableClubsCovered(players: Player[]): void {
  const missing = getMissingPlayableClubs(players);
  if (missing.length > 0) {
    throw new Error(
      `Missing eligible players for clubs: ${missing.join(", ")}`
    );
  }
}

/** @deprecated Use getPlayersForClub — re-export category slices for recruitment. */
export const NORMAL_MODE_CATEGORY_POOLS = {
  current: CURRENT_PLAYERS.filter(isGlobalRecruitmentEligible),
  historic: HISTORIC_PLAYERS.filter(isGlobalRecruitmentEligible),
  legend: LEGEND_PLAYERS.filter(isGlobalRecruitmentEligible),
};

export function getPlayableClubNamesForPools(): string[] {
  return [...getCurrentPlayableClubNames()];
}

export { getEraPlayableClubNames, isEraPlayableClub, isCurrentPlayableClub };

export { clubsMatch, resolveCanonicalClubName } from "../clubs/club-match";
