import type { Player } from "../types";
import {
  getTeamsWithYearRosters,
  getYearsForTeam,
} from "../players/team-year-rosters";

const CURRENT_SEASON_YEAR = 2026;

export interface SlotRevealTarget {
  team: string;
  year: string;
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
  };
}

/** Teams allowed in Normal Mode slot animation — roster-backed playable clubs only. */
export function getSlotSpinTeamPool(targetTeam: string): string[] {
  const clubs = getTeamsWithYearRosters();
  const shuffled = [...clubs].sort(() => Math.random() - 0.5);
  if (!shuffled.includes(targetTeam)) {
    shuffled.unshift(targetTeam);
  }
  return shuffled;
}

/** Years allowed in Normal Mode slot animation — roster years only. */
export function getSlotSpinYearPool(targetYear: string): string[] {
  const rosterYears = new Set<string>();
  for (const team of getTeamsWithYearRosters()) {
    for (const year of getYearsForTeam(team)) {
      rosterYears.add(year);
    }
  }
  const years = [...rosterYears].sort((a, b) => Number(b) - Number(a));
  if (!years.includes(targetYear)) {
    years.unshift(targetYear);
  }
  return years;
}

/** @deprecated Use getSlotSpinTeamPool */
export function getTeamSpinPool(targetTeam: string): string[] {
  return getSlotSpinTeamPool(targetTeam);
}

/** @deprecated Use getSlotSpinYearPool */
export function getYearSpinPool(targetYear: string): string[] {
  return getSlotSpinYearPool(targetYear);
}
