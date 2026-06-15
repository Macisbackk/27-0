import type { Player, PlayerCategory, Position } from "../types";
import { formatPlayerDisplayName } from "./prime-year";
import { POSITION_LABELS } from "../positions";
import { getPlayerAge } from "./player-age";

export type ShowcaseSortKey =
  | "rating"
  | "value"
  | "tries"
  | "appearances"
  | "name";

export type ShowcaseSortDir = "asc" | "desc";

export type RatingFilter = "all" | "70" | "80" | "90" | "95";

export type TierFilter =
  | "all"
  | "legend"
  | "elite"
  | "star"
  | "starter"
  | "squad";

export const TIER_FILTER_LABELS: Record<Exclude<TierFilter, "all">, string> = {
  legend: "Legend",
  elite: "Elite",
  star: "Star",
  starter: "Starter",
  squad: "Squad Player",
};

export type ShowcaseBrowseMode = "all" | "teamYear";

export type AgeFilter =
  | "all"
  | "under21"
  | "21-24"
  | "25-29"
  | "30-34"
  | "35plus"
  | "unknown";

export const AGE_FILTER_LABELS: Record<AgeFilter, string> = {
  all: "Any Age",
  under21: "Under 21",
  "21-24": "21–24",
  "25-29": "25–29",
  "30-34": "30–34",
  "35plus": "35+",
  unknown: "Unknown",
};

export interface ShowcaseFilters {
  search: string;
  status: PlayerCategory | "all";
  position: Position | "all";
  club: string;
  ratingMin: RatingFilter;
  tier: TierFilter;
  yearsActive: string;
  age: AgeFilter;
  browseMode: ShowcaseBrowseMode;
  teamYearTeam: string;
  teamYearYear: string;
}

/** Showcase tier for filter chips — legends are always Legend tier. */
export function getPlayerTier(
  player: Player
): Exclude<TierFilter, "all"> {
  if (player.category === "legend") return "legend";
  if (player.peakRating >= 94) return "elite";
  if (player.peakRating >= 90) return "star";
  if (player.peakRating >= 85) return "starter";
  return "squad";
}

export interface ShowcaseDbStats {
  total: number;
  current: number;
  historic: number;
  legends: number;
  highestRated: Player | null;
  highestValue: Player | null;
}

export function computeShowcaseDbStats(players: Player[]): ShowcaseDbStats {
  let highestRated: Player | null = null;
  let highestValue: Player | null = null;

  for (const p of players) {
    if (!highestRated || p.peakRating > highestRated.peakRating) {
      highestRated = p;
    }
    if (!highestValue || p.value > highestValue.value) {
      highestValue = p;
    }
  }

  return {
    total: players.length,
    current: players.filter((p) => p.category === "current").length,
    historic: players.filter((p) => p.category === "historic").length,
    legends: players.filter((p) => p.category === "legend").length,
    highestRated,
    highestValue,
  };
}

export function getUniqueClubs(players: Player[]): string[] {
  return [...new Set(players.map((p) => p.club))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function ratingThreshold(filter: RatingFilter): number {
  switch (filter) {
    case "70":
      return 70;
    case "80":
      return 80;
    case "90":
      return 90;
    case "95":
      return 95;
    default:
      return 0;
  }
}

function matchesSearch(player: Player, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const positionLabel = POSITION_LABELS[player.position].toLowerCase();

  const displayName = formatPlayerDisplayName(player).toLowerCase();

  return (
    player.name.toLowerCase().includes(q) ||
    displayName.includes(q) ||
    player.club.toLowerCase().includes(q) ||
    positionLabel.includes(q) ||
    player.position.toLowerCase().replace(/_/g, " ").includes(q) ||
    (player.primeYear !== undefined && String(player.primeYear).includes(q))
  );
}

function matchesAgeFilter(player: Player, filter: AgeFilter): boolean {
  const age = getPlayerAge(player);
  switch (filter) {
    case "all":
      return true;
    case "unknown":
      return age === undefined;
    case "under21":
      return age !== undefined && age < 21;
    case "21-24":
      return age !== undefined && age >= 21 && age <= 24;
    case "25-29":
      return age !== undefined && age >= 25 && age <= 29;
    case "30-34":
      return age !== undefined && age >= 30 && age <= 34;
    case "35plus":
      return age !== undefined && age >= 35;
  }
}

/** 1. Status */
function passesStatusFilter(
  player: Player,
  status: ShowcaseFilters["status"]
): boolean {
  return status === "all" || player.category === status;
}

/** 2. Team — roster membership (Team > Year mode) or club name */
function passesTeamFilter(
  player: Player,
  filters: ShowcaseFilters,
  teamYearIds: Set<string> | null | undefined
): boolean {
  if (filters.browseMode === "teamYear") {
    if (filters.teamYearTeam === "all") return true;
    return teamYearIds?.has(player.id) ?? false;
  }
  return filters.club === "all" || player.club === filters.club;
}

/** 3. Year — specific roster year or yearsActive text */
function passesYearFilter(player: Player, filters: ShowcaseFilters): boolean {
  if (filters.browseMode === "teamYear" && filters.teamYearYear) {
    return true;
  }
  const yearQuery = filters.yearsActive.trim();
  if (!yearQuery) return true;
  return player.yearsActive
    .toLowerCase()
    .includes(yearQuery.toLowerCase());
}

function passesSecondaryFilters(
  player: Player,
  filters: ShowcaseFilters
): boolean {
  const minRating = ratingThreshold(filters.ratingMin);
  if (filters.position !== "all" && player.position !== filters.position) {
    return false;
  }
  if (minRating > 0 && player.peakRating < minRating) return false;
  if (filters.tier !== "all" && getPlayerTier(player) !== filters.tier) {
    return false;
  }
  return true;
}

/**
 * Single showcase filter pipeline:
 * Status → Team → Year → Age → Search → (position/rating/tier refinements)
 */
export function filterShowcasePlayers(
  players: Player[],
  filters: ShowcaseFilters,
  teamYearIds?: Set<string> | null
): Player[] {
  return players.filter((player) => {
    if (player.availableInGame === false) return false;
    if (!passesStatusFilter(player, filters.status)) return false;
    if (!passesTeamFilter(player, filters, teamYearIds)) return false;
    if (!passesYearFilter(player, filters)) return false;
    if (!matchesAgeFilter(player, filters.age)) return false;
    if (!matchesSearch(player, filters.search)) return false;
    if (!passesSecondaryFilters(player, filters)) return false;
    return true;
  });
}

/** Filter → sort pipeline for showcase views. */
export function applyShowcasePipeline(
  players: Player[],
  filters: ShowcaseFilters,
  sortKey: ShowcaseSortKey,
  sortDir: ShowcaseSortDir,
  teamYearIds?: Set<string> | null
): Player[] {
  return sortShowcasePlayers(
    filterShowcasePlayers(players, filters, teamYearIds),
    sortKey,
    sortDir
  );
}

function sortValue(player: Player, key: ShowcaseSortKey): string | number {
  switch (key) {
    case "rating":
      return player.peakRating;
    case "value":
      return player.value;
    case "tries":
      return player.tries ?? 0;
    case "appearances":
      return player.appearances ?? 0;
    case "name":
      return player.name.toLowerCase();
  }
}

export function sortShowcasePlayers(
  players: Player[],
  key: ShowcaseSortKey,
  dir: ShowcaseSortDir
): Player[] {
  const sorted = [...players].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return sorted;
}
