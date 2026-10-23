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
import { formatShowcaseClubYear, isGameplayYearCard } from "./year-card";

export type PlayerShowcaseViewModel = {
  playerId: string;
  displayName: string;
  /** Card / popup title: era cards read "Name (2005)", current players just "Name". */
  title: string;
  /** The season (or span) in the title, for era cards. */
  titleYear?: string;
  clubId: string;
  clubName: string;
  clubYearLabel: string;
  /** Club only for era cards (the year is in the title); club and season for current players. */
  clubLabel: string;
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
 * Showcase card/popup title is the player's name only.
 * Season years belong in clubYearLabel / year metadata — not the title.
 */
export function formatShowcaseDisplayName(player: Player): string {
  return getPlayerDisplayName(player);
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
  const titleYear = showcaseTitleYear(player);
  const clubName = player.displayClub ?? player.team ?? player.club;

  return {
    playerId: player.id,
    displayName,
    title: titleYear && displayName ? `${displayName} (${titleYear})` : displayName,
    titleYear,
    clubId: player.club,
    clubName,
    clubYearLabel: formatShowcaseClubYear(player),
    clubLabel: titleYear ? clubName : formatShowcaseClubYear(player),
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

/** "2005" for an era year card, "1996–2010" for a career card, nothing for current players. */
export function showcaseTitleYear(player: Player): string | undefined {
  if (player.category === "current") return undefined;
  if (isGameplayYearCard(player)) {
    const year = player.year ?? player.cardYear ?? player.primeYear;
    if (typeof year === "number" && Number.isFinite(year)) return String(year);
  }
  const span = player.yearsActive?.trim();
  if (span) return span;
  const year = player.year ?? player.cardYear ?? player.primeYear;
  return typeof year === "number" && Number.isFinite(year) ? String(year) : undefined;
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
