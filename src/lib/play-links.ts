/** Public playable modes — Normal (Classic) and Challenge Cup only. */
export type PublicPlayMode = "classic" | "cup";

export type EraVariant = "current" | "era";

const CURRENT_SEASON_YEAR = "2026";

/** Build play URLs for public modes. Era uses `?era=1` (with `cup=1` for Challenge Cup). */
export function buildPlayHref(
  mode: PublicPlayMode,
  eraMode = false
): string {
  const params = new URLSearchParams();
  if (mode === "cup") {
    params.set("cup", "1");
  }
  if (eraMode) {
    params.set("era", "1");
  }
  const qs = params.toString();
  return qs ? `/play?${qs}` : "/play";
}

export function isCupEraMode(search: { cup?: string | null; era?: string | null }): boolean {
  return search.cup === "1" && search.era === "1";
}

export function isNormalEraMode(search: {
  cup?: string | null;
  era?: string | null;
}): boolean {
  return search.cup !== "1" && search.era === "1";
}

export function resolveEraVariant(search: {
  cup?: string | null;
  era?: string | null;
}): EraVariant {
  return search.era === "1" ? "era" : "current";
}

export function isPlayModeActive(
  pathname: string,
  search: {
    cup?: string | null;
    draft?: string | null;
    fantasy?: string | null;
    era?: string | null;
    difficulty?: string | null;
  },
  mode: PublicPlayMode,
  /** When mode is classic or cup, match Current (false) vs Era (true). Omit to match any variant. */
  eraMode?: boolean
): boolean {
  if (!pathname.startsWith("/play")) return false;
  const isCup = search.cup === "1";
  const isHidden =
    search.draft === "1" ||
    search.fantasy === "1" ||
    search.difficulty === "hard";

  if (isHidden) return false;

  const matches = mode === "cup" ? isCup : !isCup;
  if (!matches) return false;

  if (eraMode !== undefined) {
    const urlEra = search.era === "1";
    return urlEra === eraMode;
  }

  return true;
}

export { CURRENT_SEASON_YEAR };
