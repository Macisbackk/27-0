import type { Player, PlayerCategory } from "../types";
import { parsePlayerId } from "./prime-year";

export type PlayerCardStatus = "Current" | "Historic" | "Legend";

const CURRENT_SEASON_YEAR = 2026;

export function slugifyClubName(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildPlayerTeamYearId(
  club: string,
  year: number | string
): string {
  return `${slugifyClubName(club)}-${year}`;
}

export function parseYearFromPlayerId(id: string): number | undefined {
  const match = id.match(/-(\d{4})$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function parseYearsActiveStart(yearsActive: string): number | undefined {
  const match = yearsActive.replace(/-/g, "–").match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function parseYearsActiveEnd(yearsActive: string): number | undefined {
  const normalized = yearsActive.replace(/-/g, "–");
  if (/present/i.test(normalized)) return CURRENT_SEASON_YEAR;
  const years = [...normalized.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  if (years.length === 0) return undefined;
  return years.length > 1 ? years[years.length - 1] : years[0];
}

export function isSingleYearSpan(yearsActive: string): boolean {
  const start = parseYearsActiveStart(yearsActive);
  const end = parseYearsActiveEnd(yearsActive);
  if (start === undefined || end === undefined) return false;
  return start === end;
}

export function resolveBasePlayerId(
  id: string,
  explicit?: string
): string {
  if (explicit?.trim()) return explicit.trim();
  return parsePlayerId(id).baseId;
}

export function categoryToCardStatus(
  category: PlayerCategory | string
): PlayerCardStatus {
  if (category === "current") return "Current";
  if (category === "legend") return "Legend";
  return "Historic";
}

export function resolveRawCardYear(
  raw: Record<string, unknown>,
  primeYearOverrides: Record<string, number> = {}
): number | undefined {
  const explicitYear = raw.year as number | undefined;
  if (explicitYear !== undefined && Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  const cardYear = raw.cardYear as number | undefined;
  if (cardYear !== undefined && Number.isFinite(cardYear)) return cardYear;

  const idYear = parseYearFromPlayerId(raw.id as string);
  if (idYear !== undefined) return idYear;

  if (raw.category === "current") return CURRENT_SEASON_YEAR;

  const baseId = resolveBasePlayerId(raw.id as string, raw.basePlayerId as string);
  const prime =
    primeYearOverrides[raw.id as string] ??
    primeYearOverrides[baseId] ??
    (raw.primeYear as number | undefined);
  if (prime !== undefined && Number.isFinite(prime)) return prime;

  const start = parseYearsActiveStart((raw.yearsActive as string) ?? "");
  if (start !== undefined) return start;

  return undefined;
}

export function isYearPinnedRaw(raw: Record<string, unknown>): boolean {
  const year = resolveRawCardYear(raw);
  const club = raw.club as string | undefined;
  if (year === undefined || !club?.trim()) return false;
  const teamYearId =
    (raw.teamYearId as string | undefined) ??
    buildPlayerTeamYearId(club, year);
  return teamYearId === buildPlayerTeamYearId(club, year);
}

export function isYearPinnedPlayer(player: Player): boolean {
  if (player.year === undefined || !player.teamYearId?.trim()) return false;
  return (
    player.teamYearId === buildPlayerTeamYearId(player.club, player.year)
  );
}

/** True when a record still represents a multi-year career span, not a pinned year card. */
export function isGenericCareerRaw(raw: Record<string, unknown>): boolean {
  if (raw.category === "current") return false;
  const yearsActive = (raw.yearsActive as string) ?? "";
  if (!yearsActive.trim()) return true;
  if (isSingleYearSpan(yearsActive)) return false;
  if (/present/i.test(yearsActive)) return false;

  const year = resolveRawCardYear(raw);
  if (year === undefined) return true;

  const start = parseYearsActiveStart(yearsActive);
  const end = parseYearsActiveEnd(yearsActive);
  if (start === undefined || end === undefined) return true;
  return year < start || year > end;
}

export function isGameplayYearCard(player: Player): boolean {
  if (!isYearPinnedPlayer(player)) return false;
  if (player.category === "current") {
    return player.year === CURRENT_SEASON_YEAR;
  }
  if (player.year !== undefined && isSingleYearSpan(player.yearsActive)) {
    return true;
  }
  if (player.cardYear !== undefined && player.cardYear === player.year) {
    return true;
  }
  return parseYearFromPlayerId(player.id) === player.year;
}

export function formatShowcaseClubYear(player: Player): string {
  const club = player.displayClub ?? player.team ?? player.club;
  const year = player.year ?? player.cardYear ?? CURRENT_SEASON_YEAR;
  return `${club} · ${year}`;
}
