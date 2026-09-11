import { isCurrentPlayableClub } from "../clubs/super-league-display";
import type { Player } from "../types";

/**
 * Active Super League season treated as "Current" in Player Showcase
 * (and elsewhere that imports this module).
 *
 * When rolling over to 2027: bump this to 2027 after '27 squads ship and
 * are ready to be the default Current filter / pools.
 */
export const CURRENT_SEASON_YEAR = 2026;

/**
 * Modern squad seasons that may exist as `category: "current"` year cards.
 * Include the next season early so '27 squads can land without code churn;
 * only {@link CURRENT_SEASON_YEAR} counts as Showcase "Current" until rollover.
 */
export const CURRENT_ERA_SEASON_YEARS = [2026, 2027] as const;

export type CurrentEraSeasonYear = (typeof CURRENT_ERA_SEASON_YEARS)[number];

export function isCurrentEraSeasonYear(
  year: number
): year is CurrentEraSeasonYear {
  return (CURRENT_ERA_SEASON_YEARS as readonly number[]).includes(year);
}

export function isActiveCurrentSeasonYear(year: number): boolean {
  return year === CURRENT_SEASON_YEAR;
}

/** Season years prepared after the active current year (e.g. 2027). */
export function getUpcomingCurrentEraSeasonYears(): number[] {
  return CURRENT_ERA_SEASON_YEARS.filter((year) => year > CURRENT_SEASON_YEAR);
}

/**
 * Resolve the season year for a current-era card.
 * Defaults to the active current season when year fields are missing.
 */
export function resolveCurrentCardSeasonYear(player: Player): number {
  const year = player.year ?? player.cardYear;
  if (typeof year === "number" && Number.isFinite(year)) return year;
  return CURRENT_SEASON_YEAR;
}

/**
 * True when a player belongs in the active Super League Current pool
 * (metadata-driven — not a name blacklist).
 */
export function isCurrentSuperLeaguePlayer(player: Player): boolean {
  if (player.availableInGame === false) return false;
  if (player.superLeagueEligible === false) return false;
  if (player.category !== "current") return false;
  if (!isActiveCurrentSeasonYear(resolveCurrentCardSeasonYear(player))) {
    return false;
  }
  const club = player.displayClub ?? player.team ?? player.club;
  return isCurrentPlayableClub(club);
}

/**
 * Showcase "Current" type filter: active Super League season only.
 * Future current-era cards (e.g. '27) stay category "current" but filter via Year
 * until {@link CURRENT_SEASON_YEAR} is rolled forward.
 * Championship leftovers are excluded via {@link isCurrentSuperLeaguePlayer}.
 */
export function isShowcaseCurrentPlayer(player: Player): boolean {
  return isCurrentSuperLeaguePlayer(player);
}
