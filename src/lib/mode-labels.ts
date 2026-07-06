import type { GameDifficulty, GameMode } from "./types";

export function getSeasonReviewLabel(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false
): string {
  if (mode === "DRAFT") return "Draft Mode Season Review";
  return normalEraMode ? "Era Quick Mode Season Review" : "Quick Mode Season Review";
}

export function getQuickModeLabel(normalEraMode = false): string {
  return normalEraMode ? "Era Quick Mode" : "Quick Mode";
}

export function getQuickSeasonLabel(normalEraMode = false): string {
  return normalEraMode ? "Era quick season" : "Quick season";
}

export function getQuickSeasonStartLabel(normalEraMode = false): string {
  return `${getQuickSeasonLabel(normalEraMode)} →`;
}

export function getQuickModeCurrentEraHint(normalEraMode: boolean): string {
  return normalEraMode
    ? "Historic Super League team-years — spin club and season together."
    : "2026 current squads — club spins with today's rosters.";
}

export function getPlayPageTitle(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false
): string {
  if (mode === "DRAFT") return "Draft Mode";
  return normalEraMode ? "Era Quick Mode" : "Quick Mode";
}

export const DRAFT_MODE_INTRO =
  "Pick between two players, then choose where they play on your team sheet. Natural positions carry no penalty; out-of-position picks cost 5 OVR. Scrum Half and Stand Off share one pool.";

export const DRAFT_MODE_RULE =
  "Choose one player from the pair offered, then pick their position. No penalty at natural position; −5 OVR if out of position (Stand Off/Scrum Half swaps are fine).";

