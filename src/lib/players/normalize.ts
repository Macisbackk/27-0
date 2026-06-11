import type { Player } from "../types";
import ratingOverrides from "../../../data/rating-overrides.json";
import { compressPeakRating, ratingToValue } from "./ratings";

const RATING_OVERRIDES = ratingOverrides as Record<string, number>;
import { resolvePosition } from "./position-utils";
import { resolveYearsActive } from "./years-active";
import { resolveIntlCaps } from "./intl-caps";
import { resolveDisplayClub } from "../clubs/super-league-display";
import { resolveCareerTries } from "./career-tries";
import { resolveCategory } from "./active";
import { getDreamTeamYears, getGoldenBootYears } from "./achievements";

export function normalizePlayer(raw: Record<string, unknown>): Player {
  const id = raw.id as string;
  const rawRating = (raw.peakRating ?? raw.rating) as number;
  const rawCategory = raw.category as Player["category"];
  const { position, originalPosition, mappedFromUtility } =
    resolvePosition(raw);
  const yearsActive = resolveYearsActive(
    id,
    (raw.yearsActive as string) ?? ""
  );
  const category = resolveCategory(rawCategory, yearsActive);
  let peakRating = compressPeakRating(rawRating, category);

  if (RATING_OVERRIDES[id] !== undefined) {
    peakRating = RATING_OVERRIDES[id];
  }

  const rawClub = raw.club as string;
  const name = raw.name as string;

  return {
    id,
    name,
    club: resolveDisplayClub(id, rawClub, name),
    position,
    originalPosition: mappedFromUtility ? originalPosition : undefined,
    mappedFromUtility,
    nationality: raw.nationality as string,
    yearsActive,
    category,
    peakRating,
    rating: peakRating,
    value: ratingToValue(peakRating),
    appearances: raw.appearances as number | undefined,
    tries:
      (raw.tries as number | undefined) ?? resolveCareerTries(id, category),
    intlCaps: resolveIntlCaps(id, raw.intlCaps),
    hallOfFame: raw.hallOfFame as boolean | undefined,
    clubLegend: raw.clubLegend as boolean | undefined,
    manOfSteel: raw.manOfSteel as boolean | undefined,
    challengeCupWinner: raw.challengeCupWinner as boolean | undefined,
    superLeagueWinner: raw.superLeagueWinner as boolean | undefined,
    lanceToddTrophy: raw.lanceToddTrophy as boolean | undefined,
    dreamTeamYears: getDreamTeamYears(id),
    goldenBootYears: getGoldenBootYears(id),
    availableInGame:
      raw.availableInGame === false ? false : undefined,
  };
}

// Re-export for consumers
export { normalizePosition, isUtilityPosition, resolvePosition } from "./position-utils";
