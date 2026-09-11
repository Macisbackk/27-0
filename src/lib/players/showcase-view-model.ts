import type { Player, PlayerCategory } from "../types";
import { getCachedPlayerAchievements } from "./achievement-cache";
import {
  CURRENT_SEASON_YEAR,
  resolveCurrentCardSeasonYear,
} from "./current-season";
import { getPlayerDisplayName } from "./display-name-resolver";
import { getPlayerAge } from "./player-age";
import {
  getPlayerRatingContext,
  type PlayerRatingContext,
} from "./rating-context";
import { formatShortYear } from "./prime-year";
import { formatShowcaseClubYear } from "./year-card";

export type PlayerShowcaseViewModel = {
  playerId: string;
  displayName: string;
  clubId: string;
  clubName: string;
  clubYearLabel: string;
  position: string;
  nationality: string;
  rating: number;
  ratingContext: PlayerRatingContext;
  playerType: PlayerCategory;
  year?: number;
  yearsActive: string;
  age?: number;
  appearances?: number;
  tries?: number;
  achievements: string[];
  /** Stable identity for React keys and popup resolution. */
  player: Player;
};

function resolveShowcaseYear(player: Player): number | undefined {
  if (player.category === "current") {
    return resolveCurrentCardSeasonYear(player);
  }
  const year = player.year ?? player.cardYear ?? player.primeYear;
  return typeof year === "number" && Number.isFinite(year) ? year : undefined;
}

/**
 * Showcase titles always carry a short year when known:
 * Current → "Bevan French '26"; year cards → "Jamie Peacock '03".
 * Future current-era seasons (e.g. '27) use their card year once squads exist.
 */
export function formatShowcaseDisplayName(player: Player): string {
  const name = getPlayerDisplayName(player);
  if (!name) return name;
  if (/\s'\d{2}$/.test(name)) return name;

  const year = resolveShowcaseYear(player);
  if (year === undefined) return name;

  return `${name} ${formatShortYear(year)}`;
}

/**
 * Normalise any Showcase-eligible Player into one view model.
 * Cards and popup must render from this (or the same playerId → lookup).
 */
export function toPlayerShowcaseViewModel(
  player: Player
): PlayerShowcaseViewModel {
  const displayName = formatShowcaseDisplayName(player);
  const achievements = getCachedPlayerAchievements(player, "compact").map(
    (a) => a.label
  );
  const age = getPlayerAge(player);

  return {
    playerId: player.id,
    displayName,
    clubId: player.club,
    clubName: player.displayClub ?? player.team ?? player.club,
    clubYearLabel: formatShowcaseClubYear(player),
    position: player.position,
    nationality: player.nationality ?? "",
    rating: player.peakRating,
    ratingContext: getPlayerRatingContext(player),
    playerType: player.category,
    year: resolveShowcaseYear(player) ?? CURRENT_SEASON_YEAR,
    yearsActive: player.yearsActive,
    age: age ?? undefined,
    appearances: player.appearances,
    tries: player.tries,
    achievements,
    player,
  };
}

/** Dev-only guard: card and popup must resolve the same name for an ID. */
export function assertShowcaseCardPopupNameMatch(
  playerId: string,
  cardDisplayName: string,
  popupDisplayName: string
): void {
  if (process.env.NODE_ENV === "production") return;
  if (cardDisplayName === popupDisplayName) return;
  console.error("Player Showcase name mismatch", {
    playerId,
    cardDisplayName,
    popupDisplayName,
  });
}
