/** Public playable mode — Normal (Classic) only. */
export type PublicPlayMode = "classic";

export type EraVariant = "current" | "era";

const CURRENT_SEASON_YEAR = "2026";

/** Build play URLs for public modes. Era uses `?era=1`. */
export function buildPlayHref(mode: PublicPlayMode, eraMode = false): string {
  const params = new URLSearchParams();
  if (eraMode) {
    params.set("era", "1");
  }
  const qs = params.toString();
  return qs ? `/play?${qs}` : "/play";
}

export function isNormalEraMode(search: {
  cup?: string | null;
  era?: string | null;
}): boolean {
  return search.era === "1";
}

export function resolveEraVariant(search: {
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
  eraMode?: boolean
): boolean {
  if (!pathname.startsWith("/play")) return false;
  const isHidden =
    search.cup === "1" ||
    search.draft === "1" ||
    search.fantasy === "1" ||
    search.difficulty === "hard";

  if (isHidden || mode !== "classic") return false;

  if (eraMode !== undefined) {
    const urlEra = search.era === "1";
    return urlEra === eraMode;
  }

  return true;
}

export { CURRENT_SEASON_YEAR };
