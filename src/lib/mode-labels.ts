import type { GameDifficulty, GameMode } from "./types";

export function getSeasonReviewLabel(
  mode: GameMode,
  difficulty: GameDifficulty
): string {
  if (mode === "DRAFT") {
    return difficulty === "HARD"
      ? "Hard Draft Mode Season Review"
      : "Draft Mode Season Review";
  }
  return difficulty === "HARD"
    ? "Hard Mode Season Review"
    : "Normal Mode Season Review";
}

export function getPlayPageTitle(
  mode: GameMode,
  difficulty: GameDifficulty
): string {
  if (mode === "CHALLENGE_CUP") return "Challenge Cup";
  if (mode === "DRAFT") {
    return difficulty === "HARD" ? "Hard Draft Mode" : "Draft Mode";
  }
  return difficulty === "HARD" ? "Hard Mode" : "Normal Mode";
}

export const DRAFT_MODE_INTRO =
  "Tap an empty slot, pick between two players for that position, and fill your squad. Natural positions carry no penalty; out-of-position placements cost 5 OVR. Scrum Half and Stand Off share one pool.";

export const DRAFT_MODE_RULE =
  "Tap an empty slot on the team sheet, then choose a player from the pair offered. No penalty at natural position; −5 OVR if out of position (Stand Off/Scrum Half swaps are fine).";
