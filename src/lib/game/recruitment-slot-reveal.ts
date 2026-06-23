import type { Player } from "../types";
import { buildTeamYearId } from "./team-year-pools";
import { getNormalModeTeamYearPools } from "./player-pool-eligibility";

const CURRENT_SEASON_YEAR = 2026;

export interface SlotRevealTarget {
  team: string;
  year: string;
  /** Canonical roster key — `${team}|${year}` */
  teamYearKey: string;
  /** Unique pool id — e.g. leeds-rhinos-2011 */
  teamYearId: string;
}

export function buildSlotRevealTarget(team: string, year: string): SlotRevealTarget {
  const teamYearId = buildTeamYearId(team, year);
  return {
    team,
    year,
    teamYearKey: `${team}|${year}`,
    teamYearId,
  };
}

export function getPlayerDisplayClub(player: Player): string {
  return player.runClub ?? player.club;
}

export function getPlayerDisplayYear(player: Player): number {
  if (player.category === "current") return CURRENT_SEASON_YEAR;
  if (player.primeYear !== undefined) return player.primeYear;
  if (player.cardYear !== undefined) return player.cardYear;
  const match = player.id.match(/-(\d{4})$/);
  if (match) return Number.parseInt(match[1], 10);
  return CURRENT_SEASON_YEAR;
}

/** Landing team/year for the slot reveal — derived from the offered pair. */
export function getSlotRevealTarget(players: [Player, Player]): SlotRevealTarget {
  const [a, b] = players;
  const pickA = a.peakRating >= b.peakRating;
  const chosen = pickA ? a : b;
  return {
    team: getPlayerDisplayClub(chosen),
    year: String(getPlayerDisplayYear(chosen)),
    teamYearKey: `${getPlayerDisplayClub(chosen)}|${String(getPlayerDisplayYear(chosen))}`,
    teamYearId: buildTeamYearId(
      getPlayerDisplayClub(chosen),
      String(getPlayerDisplayYear(chosen))
    ),
  };
}

/** All teams that can appear in Normal Mode spin animation reels. */
export function getAllNormalModeSpinTeams(): string[] {
  const teams = new Set<string>();
  for (const pool of getNormalModeTeamYearPools()) {
    teams.add(pool.team);
  }
  return [...teams].sort((a, b) => a.localeCompare(b));
}

/** All years that can appear in Normal Mode spin animation reels. */
export function getAllNormalModeSpinYears(): string[] {
  const years = new Set<string>();
  for (const pool of getNormalModeTeamYearPools()) {
    years.add(pool.year);
  }
  return [...years].sort((a, b) => Number(b) - Number(a));
}

/** Years for reel display — target team years plus global pool years for variety. */
export function getSlotSpinYearPool(targetTeam: string, targetYear: string): string[] {
  const years = new Set<string>(getAllNormalModeSpinYears());
  for (const pool of getNormalModeTeamYearPools()) {
    if (pool.team === targetTeam) years.add(pool.year);
  }
  years.add(targetYear);
  return [...years].sort((a, b) => Number(b) - Number(a));
}

/** Teams for reel display — full Normal Mode pool so every option can cycle through. */
export function getSlotSpinTeamPool(targetTeam: string, _seedKey = targetTeam): string[] {
  const teams = new Set<string>(getAllNormalModeSpinTeams());
  teams.add(targetTeam);
  return [...teams].sort((a, b) => a.localeCompare(b));
}

/** @deprecated Use getSlotSpinTeamPool */
export function getTeamSpinPool(targetTeam: string, seedKey?: string): string[] {
  return getSlotSpinTeamPool(targetTeam, seedKey);
}

/** @deprecated Use getSlotSpinYearPool */
export function getYearSpinPool(targetTeam: string, targetYear: string): string[] {
  return getSlotSpinYearPool(targetTeam, targetYear);
}
