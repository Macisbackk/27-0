import type { Player, PlayerCategory, Position } from "../types";
import { POSITION_LABELS } from "../positions";

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

export interface ShowcaseFilters {
  search: string;
  status: PlayerCategory | "all";
  position: Position | "all";
  club: string;
  ratingMin: RatingFilter;
  tier: TierFilter;
  yearsActive: string;
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

  return (
    player.name.toLowerCase().includes(q) ||
    player.club.toLowerCase().includes(q) ||
    positionLabel.includes(q) ||
    player.position.toLowerCase().replace(/_/g, " ").includes(q)
  );
}

export function filterShowcasePlayers(
  players: Player[],
  filters: ShowcaseFilters
): Player[] {
  const minRating = ratingThreshold(filters.ratingMin);

  return players.filter((player) => {
    if (player.availableInGame === false) return false;
    if (!matchesSearch(player, filters.search)) return false;
    if (filters.status !== "all" && player.category !== filters.status) {
      return false;
    }
    if (filters.position !== "all" && player.position !== filters.position) {
      return false;
    }
    if (filters.club !== "all" && player.club !== filters.club) return false;
    if (minRating > 0 && player.peakRating < minRating) return false;
    if (filters.tier !== "all" && getPlayerTier(player) !== filters.tier) {
      return false;
    }
    if (
      filters.yearsActive.trim() &&
      !player.yearsActive.toLowerCase().includes(filters.yearsActive.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });
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
