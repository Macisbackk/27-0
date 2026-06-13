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
  if (mode === "FANTASY") return "Fantasy Mode Season Review";
  return difficulty === "HARD"
    ? "Hard Mode Season Review"
    : "Normal Mode Season Review";
}

export function getPlayPageTitle(
  mode: GameMode,
  difficulty: GameDifficulty
): string {
  if (mode === "CHALLENGE_CUP") return "Challenge Cup";
  if (mode === "ERA_CHALLENGE_CUP") return "Era Challenge Cup";
  if (mode === "FANTASY") return "Fantasy Mode";
  if (mode === "DRAFT") {
    return difficulty === "HARD" ? "Hard Draft Mode" : "Draft Mode";
  }
  return difficulty === "HARD" ? "Hard Mode" : "Normal Mode";
}

export const FANTASY_MODE_INTRO =
  "Build your dream squad under a budget, then take on randomised Super League teams across 27 rounds.";

export const DRAFT_MODE_INTRO =
  "Pick between two players, then choose where they play on your team sheet. Natural positions carry no penalty; out-of-position picks cost 5 OVR. Scrum Half and Stand Off share one pool.";

export const DRAFT_MODE_RULE =
  "Choose one player from the pair offered, then pick their position. No penalty at natural position; −5 OVR if out of position (Stand Off/Scrum Half swaps are fine).";

export const ERA_CHALLENGE_CUP_INTRO =
  "Select a club and historic season, then lead a pre-built era squad through a knockout tournament against random opponents from rugby league history.";
