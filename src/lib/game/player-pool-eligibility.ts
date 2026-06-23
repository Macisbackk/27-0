import { clubsMatch, resolveCanonicalClubName } from "../clubs/club-match";
import { getPlayableClubNames } from "../clubs/super-league-display";
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
  getTeamYearPool,
  type TeamYearPool,
} from "./team-year-pools";
import { getTeamsWithYearRosters, getYearsForTeam } from "../players/team-year-rosters";
import { getTeamYearRosterMeta } from "../players/team-year-roster-meta";
import { isSuperLeagueEligiblePlayer } from "../players/super-league-eligibility";
import { getEraClubsWithTeams } from "../players/era-teams";
import type { Player } from "../types";

/** Current Super League clubs in Normal / Hard / Cup / Fantasy / Draft pools. */
export const CURRENT_PLAYABLE_CLUBS = [
  "Bradford Bulls",
  "Castleford Tigers",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Hull FC",
  "Hull KR",
  "Leeds Rhinos",
  "Leigh Leopards",
  "St Helens",
  "Toulouse Olympique",
  "Wakefield Trinity",
  "Warrington Wolves",
  "Wigan Warriors",
  "York Knights",
] as const;

export type PlayerPoolMode =
  | "normal"
  | "hard"
  | "challenge-cup"
  | "era-challenge-cup"
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

export function getNormalModeGlobalPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getHardModeGlobalPool(): Player[] {
  return getNormalModeGlobalPool();
}

export function getChallengeCupPool(clubFilter?: string): Player[] {
  if (clubFilter) {
    return getPlayersForClub(clubFilter);
  }
  return getGlobalRecruitmentPool();
}

export function getFantasyPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getDraftPool(): Player[] {
  return getGlobalRecruitmentPool();
}

export function getNormalModeTeamYearPools(): TeamYearPool[] {
  return getAllTeamYearPools().filter((pool) => {
    const meta = getTeamYearRosterMeta(pool.team, pool.year);
    return meta?.playableInNormalSpin === true;
  });
}

/** Weighted spin pools — historic Super League years favoured over 2026-only bias. */
export function getNormalModeSpinPoolWeight(pool: TeamYearPool): number {
  const meta = getTeamYearRosterMeta(pool.team, pool.year);
  if (pool.year === "2026") return 1;
  if (meta?.source === "verified") return 6;
  return 3;
}

export function pickWeightedNormalModePool<T extends TeamYearPool>(
  pools: T[],
  rng: () => number
): T | null {
  if (pools.length === 0) return null;
  const weights = pools.map((pool) => getNormalModeSpinPoolWeight(pool));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pools.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pools[i]!;
  }
  return pools[pools.length - 1]!;
}

export function getEraChallengeCupTeamCount(): number {
  return getEraClubsWithTeams().length;
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
    case "challenge-cup":
      return auditGlobalPool(mode, getChallengeCupPool(), clubs);
    case "fantasy":
      return auditGlobalPool(mode, getFantasyPool(), clubs);
    case "draft":
      return auditGlobalPool(mode, getDraftPool(), clubs);
    case "era-challenge-cup":
      return {
        mode,
        totalPlayers: 0,
        byClub: {},
        byCategory: { current: 0, historic: 0, legend: 0 },
        missingClubs: [],
        lowCountClubs: [],
        eraOnlyExcluded: 0,
      };
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
  return getPlayableClubNames();
}

export { clubsMatch, resolveCanonicalClubName } from "../clubs/club-match";
