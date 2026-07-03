import type { GameDifficulty, GameMode } from "./types";

export function getSeasonReviewLabel(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false
): string {
  if (mode === "DRAFT") return "Draft Mode Season Review";
  if (mode === "FANTASY") return "Fantasy Mode Season Review";
  return normalEraMode ? "Era Mode Season Review" : "Current Mode Season Review";
}

export function getPlayPageTitle(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false
): string {
  if (mode === "FANTASY") return "Fantasy Mode";
  if (mode === "DRAFT") return "Draft Mode";
  return normalEraMode ? "Era Mode" : "Current Mode";
}

export const FANTASY_MODE_INTRO =
  "Build your dream squad under a budget, then take on randomised Super League teams across 27 rounds.";

export const DRAFT_MODE_INTRO =
  "Pick between two players, then choose where they play on your team sheet. Natural positions carry no penalty; out-of-position picks cost 5 OVR. Scrum Half and Stand Off share one pool.";

export const DRAFT_MODE_RULE =
  "Choose one player from the pair offered, then pick their position. No penalty at natural position; −5 OVR if out of position (Stand Off/Scrum Half swaps are fine).";

