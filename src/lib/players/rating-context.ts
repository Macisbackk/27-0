import type { Player } from "../types";

export type PlayerRatingContext =
  | "current"
  | "season"
  | "historic-peak"
  | "legend";

export const ERA_RATING_EXPLANATION =
  "Era Mode ratings reflect each player’s ability and performances in the selected season, not their overall career or all-time peak.";

export const ERA_RATING_COMPACT_EXPLANATION =
  "Season ratings: Each rating reflects how the player performed in this selected year.";

const RATING_LABELS: Record<PlayerRatingContext, string> = {
  current: "Current Rating",
  season: "Season Rating",
  "historic-peak": "Peak Rating",
  legend: "Legend Rating",
};

export function getPlayerRatingLabel(context: PlayerRatingContext): string {
  return RATING_LABELS[context];
}

export function getPlayerSeasonRatingYear(
  player: Player,
  explicitYear?: number
): number | undefined {
  if (explicitYear !== undefined) return explicitYear;
  return player.eraYear ?? player.cardYear ?? player.year;
}

export function getPlayerRatingContext(
  player: Player,
  explicitContext?: PlayerRatingContext
): PlayerRatingContext {
  if (explicitContext) return explicitContext;
  if (player.eraYear !== undefined) return "season";
  if (player.category === "legend") return "legend";
  if (
    player.category === "historic" &&
    getPlayerSeasonRatingYear(player) !== undefined
  ) {
    return "season";
  }
  if (player.category === "historic") return "historic-peak";
  return "current";
}

export function getSeasonRatingSupportText(year: number): string {
  return `Based on this player’s ability and performances during ${year}.`;
}
