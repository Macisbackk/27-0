import { SUPER_LEAGUE_CLUBS } from "../clubs";
import type { Player } from "../types";

const CURRENT_SEASON_YEAR = 2026;

const SPIN_YEARS = [
  1970, 1985, 1992, 1996, 2003, 2008, 2012, 2014, 2018, 2020, 2024, 2026,
];

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

export function getTeamSpinPool(targetTeam: string): string[] {
  const clubs = SUPER_LEAGUE_CLUBS.map((c) => c.name);
  const shuffled = [...clubs].sort(() => Math.random() - 0.5);
  if (!shuffled.includes(targetTeam)) {
    shuffled.unshift(targetTeam);
  }
  return shuffled;
}

export function getYearSpinPool(targetYear: string): string[] {
  const years = SPIN_YEARS.map(String);
  if (!years.includes(targetYear)) {
    years.unshift(targetYear);
  }
  return years;
}
