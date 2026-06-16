import { getPlayerById } from "../players";
import {
  getRosterPlayerIds,
  getTeamsWithYearRosters,
  getYearsForTeam,
  hasTeamYearRoster,
} from "../players/team-year-rosters";
import type { Player, SquadSlot } from "../types";
import { canPlayerRecruitForRemainingSlots } from "./position-placement";
import type { SlotRevealTarget } from "./recruitment-slot-reveal";

export interface TeamYearPool {
  teamYearId: string;
  team: string;
  year: string;
  playerIds: readonly string[];
}

const poolById = new Map<string, TeamYearPool>();
const poolIdsByPlayerId = new Map<string, Set<string>>();

function slugifyTeamName(team: string): string {
  return team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTeamYearId(team: string, year: string): string {
  return `${slugifyTeamName(team)}-${year}`;
}

function registerPool(team: string, year: string): TeamYearPool {
  const teamYearId = buildTeamYearId(team, year);
  const playerIds = Object.freeze([...getRosterPlayerIds(team, year)]);
  const pool: TeamYearPool = { teamYearId, team, year, playerIds };
  poolById.set(teamYearId, pool);
  for (const playerId of playerIds) {
    const ids = poolIdsByPlayerId.get(playerId) ?? new Set<string>();
    ids.add(teamYearId);
    poolIdsByPlayerId.set(playerId, ids);
  }
  return pool;
}

function ensurePoolsBuilt(): void {
  if (poolById.size > 0) return;
  for (const team of getTeamsWithYearRosters()) {
    for (const year of getYearsForTeam(team)) {
      if (hasTeamYearRoster(team, year)) {
        registerPool(team, year);
      }
    }
  }
}

export function getTeamYearPool(team: string, year: string): TeamYearPool | null {
  ensurePoolsBuilt();
  return poolById.get(buildTeamYearId(team, year)) ?? null;
}

export function getTeamYearPoolById(teamYearId: string): TeamYearPool | null {
  ensurePoolsBuilt();
  return poolById.get(teamYearId) ?? null;
}

export function getTeamYearPoolFromTarget(
  target: Pick<SlotRevealTarget, "team" | "year" | "teamYearId">
): TeamYearPool | null {
  ensurePoolsBuilt();
  return (
    poolById.get(target.teamYearId) ??
    getTeamYearPool(target.team, target.year)
  );
}

export function getAllTeamYearPools(): TeamYearPool[] {
  ensurePoolsBuilt();
  return [...poolById.values()];
}

export function isPlayerInTeamYearPool(
  playerId: string,
  pool: TeamYearPool
): boolean {
  return pool.playerIds.includes(playerId);
}

/** Resolve roster players for an exact team-year pool (step 1 of recruitment filter). */
export function getRawPlayersForTeamYearPool(pool: TeamYearPool): Player[] {
  return pool.playerIds
    .map((id) => getPlayerById(id))
    .filter((player): player is Player => !!player);
}

/**
 * Strict recruitment filter order:
 * 1. Exact team-year pool
 * 2. Remove already selected
 * 3. Keep only players who can fill a remaining position
 */
export function getEligiblePlayersForTeamYearPool(
  pool: TeamYearPool,
  usedIds: Set<string>,
  squad: SquadSlot[]
): Player[] {
  return getRawPlayersForTeamYearPool(pool).filter(
    (player) =>
      isPlayerInTeamYearPool(player.id, pool) &&
      !usedIds.has(player.id) &&
      canPlayerRecruitForRemainingSlots(player, squad)
  );
}

export function getPlayerTeamYearIds(playerId: string): string[] {
  ensurePoolsBuilt();
  return [...(poolIdsByPlayerId.get(playerId) ?? [])];
}

export function warnTeamYearPoolLeak(
  player: Player,
  target: Pick<SlotRevealTarget, "teamYearId" | "team" | "year">
): void {
  if (process.env.NODE_ENV === "production") return;
  const pool = getTeamYearPoolFromTarget(target);
  if (!pool || isPlayerInTeamYearPool(player.id, pool)) return;

  console.warn(
    "Invalid player pool leak: player does not belong to selected team-year",
    {
      selectedTeamYearId: target.teamYearId,
      playerId: player.id,
      playerName: player.name,
      playerTeamYearIds: getPlayerTeamYearIds(player.id),
    }
  );
}
