import type { Player } from "../types";

/** Infer birth year from career start when DOB is missing (current-era newcomers). */
export function inferBirthYearFromYearsActive(
  yearsActive?: string
): number | undefined {
  if (!yearsActive) return undefined;

  const present = yearsActive.match(/^(\d{4})\s*[–-]\s*Present/i);
  if (present) {
    const debutYear = Number.parseInt(present[1]!, 10);
    if (!Number.isFinite(debutYear)) return undefined;
    // Typical Super League debut age for squad-listed players.
    return debutYear - 22;
  }

  const range = yearsActive.match(/^(\d{4})\s*[–-]\s*(\d{4})/);
  if (range) {
    const debutYear = Number.parseInt(range[1]!, 10);
    if (!Number.isFinite(debutYear)) return undefined;
    return debutYear - 18;
  }

  return undefined;
}

/** Derive birth year from explicit field or date-of-birth string. */
export function resolveBirthYear(
  birthYear?: number,
  dateOfBirth?: string,
  yearsActive?: string
): number | undefined {
  if (birthYear !== undefined && Number.isFinite(birthYear)) {
    return birthYear;
  }
  if (!dateOfBirth) {
    return inferBirthYearFromYearsActive(yearsActive);
  }

  const iso = dateOfBirth.match(/^(\d{4})-/);
  if (iso) return Number.parseInt(iso[1], 10);

  const dmy = dateOfBirth.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return Number.parseInt(dmy[3], 10);

  const leadingYear = dateOfBirth.match(/^(\d{4})/);
  if (leadingYear) return Number.parseInt(leadingYear[1], 10);

  return inferBirthYearFromYearsActive(yearsActive);
}

/** Card-era year from explicit field or year suffix on player id. */
export function resolveCardYear(
  cardYear?: number,
  parsedYearCardYear?: number
): number | undefined {
  if (cardYear !== undefined) return cardYear;
  return parsedYearCardYear;
}

function parseDateOfBirth(dob: string): Date | undefined {
  if (/^\d{4}-\d{2}-\d{2}/.test(dob)) {
    const parsed = new Date(dob);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const dmy = dob.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!dmy) return undefined;

  const day = Number.parseInt(dmy[1], 10);
  const month = Number.parseInt(dmy[2], 10) - 1;
  const year = Number.parseInt(dmy[3], 10);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function calculatePreciseAge(
  dateOfBirth: string,
  asOf: Date = new Date()
): number | undefined {
  const birth = parseDateOfBirth(dateOfBirth);
  if (!birth) return undefined;

  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : undefined;
}

/** Age a player would be during a given calendar / season year. */
export function getAgeAtYear(
  player: Player,
  year: number
): number | undefined {
  const birthYear = resolveBirthYear(player.birthYear, player.dateOfBirth);
  if (birthYear === undefined) return undefined;
  const age = year - birthYear;
  return age >= 0 && age <= 120 ? age : undefined;
}

function resolveReferenceYear(player: Player): number | undefined {
  return player.eraYear ?? player.primeYear ?? player.cardYear;
}

/** Player age at card era (historic/legend) or current age (current players). */
export function getPlayerAge(player: Player): number | undefined {
  const birthYear = resolveBirthYear(player.birthYear, player.dateOfBirth);

  if (player.category === "current") {
    if (player.dateOfBirth) {
      const precise = calculatePreciseAge(player.dateOfBirth);
      if (precise !== undefined) return precise;
    }
    if (birthYear === undefined) return undefined;
    return new Date().getFullYear() - birthYear;
  }

  if (birthYear === undefined) return undefined;
  const referenceYear = resolveReferenceYear(player);
  if (referenceYear === undefined) return undefined;
  return referenceYear - birthYear;
}

/** Display value for age stat boxes — never guesses beyond available data. */
export function formatPlayerAge(player: Player): string {
  const age = getPlayerAge(player);
  return age !== undefined ? String(age) : "Unknown";
}

/** Inline label for review panels, e.g. "Age: 27". */
export function formatPlayerAgeLabel(player: Player): string {
  return `Age: ${formatPlayerAge(player)}`;
}

/** Clone a player with era year set for Era Mode age display. */
export function withEraYear(player: Player, year: number): Player {
  return { ...player, eraYear: year };
}
