/**
 * Canonical player display-name resolver.
 * Showcase cards, popup, search, and A–Z sort must all use this — never append
 * season years, club names, or IDs to the name string.
 */

export type PlayerNameSource = {
  id: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  knownAs?: string;
  surname?: string;
  playerName?: string;
};

export type PlayerNameResolveResult = {
  displayName: string;
  valid: boolean;
  usedFallbackFields: boolean;
  problems: string[];
  rawNameFields: {
    fullName?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    knownAs?: string;
    surname?: string;
    playerName?: string;
  };
};

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Collapse internal whitespace runs; preserve punctuation and casing. */
export function normalizePlayerNameWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function joinNameParts(parts: Array<string | undefined>): string | undefined {
  const joined = parts
    .map((part) => asTrimmedString(part))
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return joined.length > 0 ? normalizePlayerNameWhitespace(joined) : undefined;
}

function isInvalidResolvedName(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower === "undefined" ||
    lower === "null" ||
    lower === "[object object]" ||
    lower === "unknown" ||
    lower === "unknown player"
  );
}

/**
 * Resolve a display name from whatever name fields a record may carry.
 * Does not title-case, lowercase, or append season/club/id.
 */
export function resolvePlayerDisplayName(
  player: PlayerNameSource
): PlayerNameResolveResult {
  const rawNameFields = {
    fullName: asTrimmedString(player.fullName),
    name: asTrimmedString(player.name),
    firstName: asTrimmedString(player.firstName),
    lastName: asTrimmedString(player.lastName),
    displayName: asTrimmedString(player.displayName),
    knownAs: asTrimmedString(player.knownAs),
    surname: asTrimmedString(player.surname),
    playerName: asTrimmedString(player.playerName),
  };

  const problems: string[] = [];
  let usedFallbackFields = false;

  const candidates: Array<{ value: string | undefined; fallback: boolean }> = [
    { value: rawNameFields.fullName, fallback: false },
    { value: rawNameFields.name, fallback: false },
    { value: rawNameFields.displayName, fallback: true },
    { value: rawNameFields.knownAs, fallback: true },
    { value: rawNameFields.playerName, fallback: true },
    {
      value: joinNameParts([rawNameFields.firstName, rawNameFields.lastName]),
      fallback: true,
    },
    {
      value: joinNameParts([rawNameFields.firstName, rawNameFields.surname]),
      fallback: true,
    },
  ];

  let displayName = "";
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const normalized = normalizePlayerNameWhitespace(candidate.value);
    if (isInvalidResolvedName(normalized)) {
      problems.push(`invalid_literal:${normalized}`);
      continue;
    }
    displayName = normalized;
    usedFallbackFields = candidate.fallback;
    break;
  }

  if (!displayName) {
    problems.push("missing_name");
    if (typeof console !== "undefined") {
      console.error("[player-name] unresolved display name", {
        playerId: player.id,
        rawNameFields,
      });
    }
    return {
      displayName: "",
      valid: false,
      usedFallbackFields: false,
      problems,
      rawNameFields,
    };
  }

  if (/\s{2,}/.test(displayName)) {
    problems.push("duplicate_whitespace");
  }
  if (usedFallbackFields) {
    problems.push("used_fallback_fields");
  }

  return {
    displayName,
    valid: true,
    usedFallbackFields,
    problems,
    rawNameFields,
  };
}

/** Canonical Showcase / UI display name (never invents Unknown Player). */
export function getPlayerDisplayName(player: PlayerNameSource): string {
  return resolvePlayerDisplayName(player).displayName;
}
