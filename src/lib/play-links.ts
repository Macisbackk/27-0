import type { GameDifficulty } from "./types";

export type PublicPlayMode = "classic" | "draft" | "cup" | "fantasy" | "eraCup";

/** Build play URLs for public modes only — never easter eggs. */
export function buildPlayHref(
  mode: PublicPlayMode,
  difficulty: GameDifficulty = "NORMAL"
): string {
  const params = new URLSearchParams();
  if (mode === "cup") {
    params.set("cup", "1");
  } else if (mode === "fantasy") {
    params.set("fantasy", "1");
  } else if (mode === "eraCup") {
    params.set("eraCup", "1");
  } else {
    if (mode === "draft") params.set("draft", "1");
    if (difficulty === "HARD") params.set("difficulty", "hard");
  }
  const qs = params.toString();
  return qs ? `/play?${qs}` : "/play";
}

export function isPlayModeActive(
  pathname: string,
  search: {
    cup?: string | null;
    draft?: string | null;
    fantasy?: string | null;
    eraCup?: string | null;
    difficulty?: string | null;
  },
  mode: PublicPlayMode,
  expectedDifficulty?: GameDifficulty
): boolean {
  if (!pathname.startsWith("/play")) return false;
  const isCup = search.cup === "1";
  const isDraft = search.draft === "1";
  const isFantasy = search.fantasy === "1";
  const isEraCup = search.eraCup === "1";
  const urlHard = search.difficulty === "hard";

  let matches = false;
  if (mode === "cup") matches = isCup;
  else if (mode === "fantasy") matches = isFantasy && !isCup && !isEraCup;
  else if (mode === "eraCup") matches = isEraCup;
  else if (mode === "draft") matches = isDraft && !isCup && !isFantasy && !isEraCup;
  else matches = !isCup && !isDraft && !isFantasy && !isEraCup;

  if (!matches) return false;
  if (
    expectedDifficulty === undefined ||
    mode === "cup" ||
    mode === "fantasy" ||
    mode === "eraCup"
  ) {
    return true;
  }
  return (expectedDifficulty === "HARD") === urlHard;
}
