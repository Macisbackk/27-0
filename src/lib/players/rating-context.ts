import type { Player } from "../types";
import { CURRENT_SEASON_YEAR } from "../play-links";
import { UI_COPY } from "@/lib/ui/copy";

export type PlayerRatingContext =
  | "current"
  | "season"
  | "historic-peak"
  | "legend";

export const ERA_RATING_EXPLANATION = "Era ratings = that season.";

export const ERA_RATING_COMPACT_EXPLANATION = UI_COPY.eraRatingNote;

export function getCurrentSeasonYearNumber(): number {
  const parsed = Number.parseInt(String(CURRENT_SEASON_YEAR), 10);
  return Number.isFinite(parsed) ? parsed : 2026;
}

export function getCurrentRatingExplanation(): string {
  return "Current ratings = this season.";
}

export function getCurrentRatingCompactExplanation(): string {
  return UI_COPY.currentRatingNote;
}

export function getCurrentRatingSupportText(
  year: number = getCurrentSeasonYearNumber()
): string {
  return `Based on the player’s performances and ability during the ${year} season.`;
}

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
