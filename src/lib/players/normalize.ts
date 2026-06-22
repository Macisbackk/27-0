import type { Player, Position } from "../types";
import { PLAYER_RATING_OVERRIDES } from "../../../data/player-rating-overrides";
import birthYearsData from "../../../data/birth-years.json";
import { compressPeakRating, computePlayerValue } from "./ratings";
import { parsePlayerId, resolvePrimeYear } from "./prime-year";
import { resolveBirthYear, resolveCardYear } from "./player-age";
import { parsePositionAbbreviations } from "./player-positions";
import { normalizePosition, resolvePosition } from "./position-utils";
import { resolveYearsActive } from "./years-active";
import { resolveIntlCaps } from "./intl-caps";
import { resolveDisplayClub } from "../clubs/super-league-display";
import { resolveCareerTries } from "./career-tries";
import { resolveCategory } from "./active";
import { getDreamTeamYears, getGoldenBootYears } from "./achievements";

const RATING_OVERRIDES = PLAYER_RATING_OVERRIDES;
const BIRTH_YEAR_OVERRIDES = birthYearsData as Record<string, number>;

function resolvePlayerPositions(
  raw: Record<string, unknown>,
  primary: Player["position"]
): Position[] {
  const rawPositions = raw.positions as string[] | string | undefined;
  if (Array.isArray(rawPositions) && rawPositions.length > 0) {
    const parsed = rawPositions.flatMap((entry) => {
      if (typeof entry !== "string") return [];
      if (entry.includes("/") || entry.length <= 3) {
        return parsePositionAbbreviations(entry);
      }
      return [normalizePosition(entry, raw)];
    });
    if (parsed.length > 0) {
      return [...new Set(parsed)];
    }
  }

  if (typeof rawPositions === "string" && rawPositions.trim()) {
    return parsePositionAbbreviations(rawPositions);
  }

  const abbrev = raw.positionAbbrev as string | undefined;
  if (abbrev?.trim()) {
    return parsePositionAbbreviations(abbrev);
  }

  return [primary];
}

export function normalizePlayer(raw: Record<string, unknown>): Player {
  const id = raw.id as string;
  const parsedId = parsePlayerId(id);
  const rawRating = (raw.peakRating ?? raw.rating) as number;
  const rawCategory = raw.category as Player["category"];
  const { position, originalPosition, mappedFromUtility } =
    resolvePosition(raw);
  const positions = resolvePlayerPositions(raw, position);
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

  const primeYear = resolvePrimeYear(
    id,
    category,
    yearsActive,
    raw.primeYear as number | undefined
  );

  const rawDateOfBirth = raw.dateOfBirth as string | undefined;
  const birthYearOverride =
    BIRTH_YEAR_OVERRIDES[parsedId.baseId] ?? BIRTH_YEAR_OVERRIDES[id];
  const birthYear = resolveBirthYear(
    (raw.birthYear as number | undefined) ?? birthYearOverride,
    rawDateOfBirth
  );
  const cardYear = resolveCardYear(
    raw.cardYear as number | undefined,
    parsedId.yearCardYear
  );
  const eraYear = raw.eraYear as number | undefined;

  return {
    id,
    baseId: parsedId.baseId !== id ? parsedId.baseId : undefined,
    name,
    club: resolveDisplayClub(id, rawClub, name),
    position,
    positions: positions.length > 1 ? positions : undefined,
    originalPosition: mappedFromUtility ? originalPosition : undefined,
    mappedFromUtility,
    nationality: raw.nationality as string,
    yearsActive,
    primeYear,
    dateOfBirth: rawDateOfBirth,
    birthYear,
    eraYear,
    cardYear,
    category,
    peakRating,
    rating: peakRating,
    value: computePlayerValue(peakRating, position, category),
    appearances: raw.appearances as number | undefined,
    tries:
      (raw.tries as number | undefined) ?? resolveCareerTries(id, category),
    intlCaps: resolveIntlCaps(id, raw.intlCaps),
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
