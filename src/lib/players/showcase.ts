import type { Player, PlayerCategory, Position } from "../types";
import { formatPlayerDisplayName } from "./prime-year";
import { POSITION_LABELS } from "../positions";
import { getPlayerEligiblePositions } from "./player-positions";

export type ShowcaseSortKey =
  | "rating"
  | "value"
  | "tries"
  | "appearances"
  | "name";

export type ShowcaseSortDir = "asc" | "desc";

/** Rating band filters for the post-floor-80 Current/Historic scale. */
export type RatingFilter =
  | "all"
  | "80-82"
  | "83-85"
  | "86-88"
  | "89-91"
  | "92-94"
  | "95+";

/** Rating band filters for the Championship 70–89 scale. */
export type ChampionshipRatingFilter =
  | "all"
  | "70-72"
  | "73-75"
  | "76-78"
  | "79-81"
  | "82-84"
  | "85+";

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

export const RATING_FILTER_LABELS: Record<Exclude<RatingFilter, "all">, string> =
  {
    "80-82": "80–82",
    "83-85": "83–85",
    "86-88": "86–88",
    "89-91": "89–91",
    "92-94": "92–94",
    "95+": "95+",
  };

export const CHAMPIONSHIP_RATING_FILTER_LABELS: Record<
  Exclude<ChampionshipRatingFilter, "all">,
  string
> = {
  "70-72": "70–72 · Development",
  "73-75": "73–75 · Squad",
  "76-78": "76–78 · Established",
  "79-81": "79–81 · Good",
  "82-84": "82–84 · Leading",
  "85+": "85+ · Elite",
};

export interface ShowcaseFilters {
  search: string;
  status: PlayerCategory | "all";
  position: Position | "all";
  club: string;
  /** Exact card year (e.g. 2023) or all seasons. */
  year: number | "all";
  ratingMin: RatingFilter;
  tier: TierFilter;
}

/** Showcase tier for filter chips — legends are always Legend tier. */
export function getPlayerTier(
  player: Player
): Exclude<TierFilter, "all"> {
  if (player.category === "legend") return "legend";
  if (player.peakRating >= 94) return "elite";
  if (player.peakRating >= 90) return "star";
  if (player.peakRating >= 86) return "starter";
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

export function getUniqueShowcaseYears(players: Player[]): number[] {
  const years = new Set<number>();
  for (const p of players) {
    const y = p.year ?? p.cardYear ?? p.primeYear;
    if (typeof y === "number" && Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

function ratingInBand(rating: number, filter: RatingFilter): boolean {
  switch (filter) {
    case "80-82":
      return rating >= 80 && rating <= 82;
    case "83-85":
      return rating >= 83 && rating <= 85;
    case "86-88":
      return rating >= 86 && rating <= 88;
    case "89-91":
      return rating >= 89 && rating <= 91;
    case "92-94":
      return rating >= 92 && rating <= 94;
    case "95+":
      return rating >= 95;
    default:
      return true;
  }
}

export function championshipRatingInBand(
  rating: number,
  filter: ChampionshipRatingFilter
): boolean {
  switch (filter) {
    case "70-72":
      return rating >= 70 && rating <= 72;
    case "73-75":
      return rating >= 73 && rating <= 75;
    case "76-78":
      return rating >= 76 && rating <= 78;
    case "79-81":
      return rating >= 79 && rating <= 81;
    case "82-84":
      return rating >= 82 && rating <= 84;
    case "85+":
      return rating >= 85;
    default:
      return true;
  }
}

/** Championship-aware tier labels (do not treat 80 as “low rated”). */
export function getChampionshipPlayerTier(
  peakRating: number
): Exclude<TierFilter, "all" | "legend"> {
  if (peakRating >= 85) return "elite";
  if (peakRating >= 82) return "star";
  if (peakRating >= 79) return "starter";
  return "squad";
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
    (player.primeYear !== undefined && String(player.primeYear).includes(q)) ||
    (player.year !== undefined && String(player.year).includes(q)) ||
    (player.cardYear !== undefined && String(player.cardYear).includes(q))
  );
}

/** 1. Status */
function passesStatusFilter(
  player: Player,
  status: ShowcaseFilters["status"]
): boolean {
  return status === "all" || player.category === status;
}

function passesTeamFilter(player: Player, filters: ShowcaseFilters): boolean {
  return filters.club === "all" || player.club === filters.club;
}

function passesYearFilter(player: Player, filters: ShowcaseFilters): boolean {
  if (filters.year === "all") return true;
  const y = player.year ?? player.cardYear ?? player.primeYear;
  return y === filters.year;
}

function passesSecondaryFilters(
  player: Player,
  filters: ShowcaseFilters
): boolean {
  if (filters.position !== "all") {
    const eligible = getPlayerEligiblePositions(player);
    if (!eligible.includes(filters.position)) return false;
  }
  if (
    filters.ratingMin !== "all" &&
    !ratingInBand(player.peakRating, filters.ratingMin)
  ) {
    return false;
  }
  if (filters.tier !== "all" && getPlayerTier(player) !== filters.tier) {
    return false;
  }
  return true;
}

/** Status → Team → Search → (position/rating/tier refinements) */
export function filterShowcasePlayers(
  players: Player[],
  filters: ShowcaseFilters
): Player[] {
  return players.filter((player) => {
    if (player.availableInGame === false) return false;
    if (!passesStatusFilter(player, filters.status)) return false;
    if (!passesTeamFilter(player, filters)) return false;
    if (!passesYearFilter(player, filters)) return false;
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
  sortDir: ShowcaseSortDir
): Player[] {
  const filtered = filterShowcasePlayers(players, filters);
  return sortShowcasePlayers(filtered, sortKey, sortDir);
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
