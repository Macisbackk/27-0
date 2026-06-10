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
  "Pick between two players, then place them in any empty slot. Natural positions carry no penalty; out-of-position placements cost 5 OVR. Repeat until your squad is full.";

export const DRAFT_MODE_RULE =
  "Choose a player from the pair offered, then tap an empty slot on the team sheet. No penalty at natural position; −5 OVR if out of position (compatible swaps are fine).";
