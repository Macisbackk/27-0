import type { Player, PlayerCategory } from "../types";
import primeYearsData from "../../../data/prime-years.json";

const PRIME_YEAR_OVERRIDES = primeYearsData as Record<string, number>;

const YEAR_CARD_ID_RE = /^(.+)-(\d{4})$/;

export interface ParsedPlayerId {
  canonicalId: string;
  baseId: string;
  yearCardYear?: number;
}

/** Split a year-card id (e.g. sam-burgess-2009) from its base slug. */
export function parsePlayerId(id: string): ParsedPlayerId {
  const match = id.match(YEAR_CARD_ID_RE);
  if (!match) {
    return { canonicalId: id, baseId: id };
  }
  const year = Number.parseInt(match[2], 10);
  return {
    canonicalId: id,
    baseId: match[1],
    yearCardYear: year,
  };
}

function parseCareerStartYear(yearsActive: string): number | undefined {
  const match = yearsActive.match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function parseCareerEndYear(yearsActive: string): number | undefined {
  if (/present/i.test(yearsActive)) {
    return new Date().getFullYear();
  }
  const years = [...yearsActive.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  return years.length > 0 ? years[years.length - 1] : undefined;
}

/** Peak display year for historic/legend cards — undefined for current players. */
export function resolvePrimeYear(
  id: string,
  category: PlayerCategory,
  yearsActive: string,
  explicitPrimeYear?: number
): number | undefined {
  if (category === "current") return undefined;

  const parsed = parsePlayerId(id);
  if (parsed.yearCardYear !== undefined) return parsed.yearCardYear;
  if (explicitPrimeYear !== undefined) return explicitPrimeYear;

  const override = PRIME_YEAR_OVERRIDES[parsed.baseId] ?? PRIME_YEAR_OVERRIDES[id];
  if (override !== undefined) return override;

  const start = parseCareerStartYear(yearsActive);
  const end = parseCareerEndYear(yearsActive);
  if (start === undefined) return undefined;
  if (end === undefined) return start;

  return Math.round(start + (end - start) * 0.45);
}

/** Short year suffix for card titles, e.g. 2009 → '09. */
export function formatPrimeYearSuffix(primeYear: number): string {
  const tail = primeYear % 100;
  return `'${String(tail).padStart(2, "0")}`;
}

/** Display name with prime-year suffix for historic/legend players. */
export function formatPlayerDisplayName(player: Player): string {
  if (player.category === "current" || player.primeYear === undefined) {
    return player.name;
  }
  return `${player.name} ${formatPrimeYearSuffix(player.primeYear)}`;
}
