/**
 * Shared guards so placeholder / team labels never enter stats or match events
 * as if they were real player names.
 */

const INVALID_PLAYER_NAME_EXACT = new Set(
  [
    "try scorer",
    "try-scorer",
    "opposition try scorer",
    "scorer",
    "unknown",
    "unknown player",
    "player",
    "the kicker",
    "kicker",
    "opp-scorer",
  ].map((s) => s.toLowerCase())
);

const INVALID_PLAYER_NAME_PATTERN =
  /^(try[\s_-]*scorer|opposition[\s_-]*try[\s_-]*scorer|unknown([\s_-]*player)?|scorer|player|the[\s_-]*kicker|kicker)$/i;

export function isInvalidPlayerName(
  name?: string | null,
  teamNames: string[] = []
): boolean {
  if (!name?.trim()) return true;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (INVALID_PLAYER_NAME_EXACT.has(lower)) return true;
  if (INVALID_PLAYER_NAME_PATTERN.test(trimmed)) return true;
  return teamNames.some((t) => t.trim().toLowerCase() === lower);
}

/** @deprecated Prefer {@link isInvalidPlayerName} */
export function isPlaceholderTryScorerName(
  name: string | undefined | null
): boolean {
  return isInvalidPlayerName(name);
}

export function filterValidPlayerNames(
  names: (string | undefined | null)[],
  teamNames: string[] = []
): string[] {
  return names.filter(
    (n): n is string => typeof n === "string" && !isInvalidPlayerName(n, teamNames)
  );
}
