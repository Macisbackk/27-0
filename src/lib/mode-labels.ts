import type { GameDifficulty, GameMode } from "./types";

export function getSeasonReviewLabel(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false,
  dailyChallengeMode = false
): string {
  if (dailyChallengeMode) {
    return normalEraMode ? "Era Daily Challenge" : "Daily Challenge";
  }
  if (mode === "DRAFT") return "Draft Review";
  return normalEraMode ? "Era Classic Review" : "Classic Review";
}

export function getQuickModeLabel(normalEraMode = false): string {
  return normalEraMode ? "Era Classic" : "Classic";
}

export function getQuickSeasonLabel(normalEraMode = false): string {
  return normalEraMode ? "Era classic season" : "Classic season";
}

export function getQuickSeasonStartLabel(normalEraMode = false): string {
  return `${getQuickSeasonLabel(normalEraMode)} →`;
}

export function getQuickModeCurrentEraHint(normalEraMode: boolean): string {
  return normalEraMode ? "Historic team-years" : "2026 squads";
}

export function getPlayPageTitle(
  mode: GameMode,
  _difficulty: GameDifficulty,
  normalEraMode = false
): string {
  if (mode === "DRAFT") return "Draft Mode";
  return normalEraMode ? "Era Classic" : "Classic";
}

export const DRAFT_MODE_INTRO =
  "Pick a player, then place them.";

export const DRAFT_MODE_RULE =
  "Natural pos: full OVR. Else −5.";
