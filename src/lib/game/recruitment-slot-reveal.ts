import type { Player } from "../types";
import {
  getTeamsWithYearRosters,
  getYearsForTeam,
} from "../players/team-year-rosters";

const CURRENT_SEASON_YEAR = 2026;

export interface SlotRevealTarget {
  team: string;
  year: string;
  /** Canonical roster key — `${team}|${year}` */
  teamYearKey: string;
}

export function buildSlotRevealTarget(team: string, year: string): SlotRevealTarget {
  return { team, year, teamYearKey: `${team}|${year}` };
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
  };
}

/** Teams allowed in Normal Mode slot animation — roster-backed playable clubs only. */
export function getSlotSpinTeamPool(targetTeam: string, seedKey = targetTeam): string[] {
  const clubs = getTeamsWithYearRosters();
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const shuffled = [...clubs].sort((a, b) => {
    const ha = (hash + a.length * 17) % 997;
    const hb = (hash + b.length * 23) % 997;
    return ha - hb;
  });
  if (!shuffled.includes(targetTeam)) {
    shuffled.unshift(targetTeam);
  }
  return shuffled;
}

/** Years allowed in Normal Mode slot animation — roster years for the target team first. */
export function getSlotSpinYearPool(targetTeam: string, targetYear: string): string[] {
  const teamYears = getYearsForTeam(targetTeam);
  const years =
    teamYears.length > 0
      ? [...teamYears]
      : [...new Set<string>(
          getTeamsWithYearRosters().flatMap((team) => getYearsForTeam(team))
        )].sort((a, b) => Number(b) - Number(a));

  if (!years.includes(targetYear)) {
    years.unshift(targetYear);
  }
  return years;
}

/** @deprecated Use getSlotSpinTeamPool */
export function getTeamSpinPool(targetTeam: string, seedKey?: string): string[] {
  return getSlotSpinTeamPool(targetTeam, seedKey);
}

/** @deprecated Use getSlotSpinYearPool */
export function getYearSpinPool(targetTeam: string, targetYear: string): string[] {
  return getSlotSpinYearPool(targetTeam, targetYear);
}
