import type { GameDifficulty } from "./types";

export type PublicPlayMode = "classic" | "draft" | "cup";

/** Build play URLs for public modes only — never easter eggs. */
export function buildPlayHref(
  mode: PublicPlayMode,
  difficulty: GameDifficulty = "NORMAL"
): string {
  const params = new URLSearchParams();
  if (mode === "cup") {
    params.set("cup", "1");
  } else {
    if (mode === "draft") params.set("draft", "1");
    if (difficulty === "HARD") params.set("difficulty", "hard");
  }
  const qs = params.toString();
  return qs ? `/play?${qs}` : "/play";
}

export function isPlayModeActive(
  pathname: string,
  search: { cup?: string | null; draft?: string | null },
  mode: PublicPlayMode
): boolean {
  if (!pathname.startsWith("/play")) return false;
  const isCup = search.cup === "1";
  const isDraft = search.draft === "1";
  if (mode === "cup") return isCup;
  if (mode === "draft") return isDraft && !isCup;
  return !isCup && !isDraft;
}
