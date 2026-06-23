import type { Player } from "../types";
import { isSuperLeagueSeason } from "./super-league-club-years";

export const SUPER_LEAGUE_START_YEAR = 1996;

function parseYearsActiveRange(yearsActive: string): {
  start: number;
  end: number | null;
} {
  const normalized = yearsActive.replace(/-/g, "–");
  const years = [...normalized.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  if (years.length === 0) {
    return { start: 0, end: null };
  }
  const start = years[0];
  if (/present/i.test(normalized)) {
    return { start, end: new Date().getFullYear() };
  }
  const end = years.length > 1 ? years[years.length - 1] : start;
  return { start, end };
}

function parseYearFromId(id: string): number | undefined {
  const match = id.match(/-(\d{4})$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/** Career ended before Super League began (pre-1996 only). */
export function isPreSuperLeagueOnlyPlayer(player: Player): boolean {
  if (player.category === "current") return false;
  if (player.superLeagueEligible === true) return false;
  if (player.superLeagueEligible === false) return true;

  const idYear = parseYearFromId(player.id);
  if (idYear !== undefined && idYear >= SUPER_LEAGUE_START_YEAR) {
    return false;
  }
  if (player.cardYear !== undefined && player.cardYear >= SUPER_LEAGUE_START_YEAR) {
    return false;
  }
  if (player.primeYear !== undefined && player.primeYear >= SUPER_LEAGUE_START_YEAR) {
    return false;
  }

  const { start, end } = parseYearsActiveRange(player.yearsActive);
  if (start === 0) return false;
  const effectiveEnd = end ?? new Date().getFullYear();
  if (effectiveEnd < SUPER_LEAGUE_START_YEAR) return true;
  if (effectiveEnd >= SUPER_LEAGUE_START_YEAR && start < SUPER_LEAGUE_START_YEAR) {
    return false;
  }
  return start < SUPER_LEAGUE_START_YEAR && effectiveEnd < SUPER_LEAGUE_START_YEAR;
}

/** True when a player may appear in Normal/Hard/Cup/Fantasy/Draft pools. */
export function isSuperLeagueEligiblePlayer(player: Player): boolean {
  if (player.superLeagueEligible === false) return false;
  if (player.superLeagueEligible === true) return true;
  if (player.category === "current") return true;
  if (isPreSuperLeagueOnlyPlayer(player)) return false;

  const idYear = parseYearFromId(player.id);
  if (idYear !== undefined && idYear >= SUPER_LEAGUE_START_YEAR) {
    return isSuperLeagueSeason(player.club, idYear);
  }
  if (player.cardYear !== undefined) {
    return player.cardYear >= SUPER_LEAGUE_START_YEAR;
  }
  if (player.primeYear !== undefined) {
    return player.primeYear >= SUPER_LEAGUE_START_YEAR;
  }

  const { end } = parseYearsActiveRange(player.yearsActive);
  const effectiveEnd = end ?? new Date().getFullYear();
  return effectiveEnd >= SUPER_LEAGUE_START_YEAR;
}

export function resolveSuperLeagueEligible(
  player: Pick<
    Player,
    | "id"
    | "category"
    | "club"
    | "yearsActive"
    | "cardYear"
    | "primeYear"
    | "superLeagueEligible"
  >
): boolean {
  if (player.superLeagueEligible !== undefined) {
    return player.superLeagueEligible;
  }
  return isSuperLeagueEligiblePlayer(player as Player);
}
