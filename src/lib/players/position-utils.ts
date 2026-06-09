import type { Position } from "../types";

/** Positions used in game squad slots */
export const GAME_POSITIONS: Position[] = [
  "FULLBACK",
  "WING",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

const POSITION_ALIASES: Record<string, Position> = {
  fullback: "FULLBACK",
  wing: "WING",
  centre: "CENTRE",
  center: "CENTRE",
  "stand-off": "STAND_OFF",
  "stand off": "STAND_OFF",
  stand_off: "STAND_OFF",
  "scrum-half": "SCRUM_HALF",
  "scrum half": "SCRUM_HALF",
  scrum_half: "SCRUM_HALF",
  prop: "PROP",
  hooker: "HOOKER",
  "second-row": "SECOND_ROW",
  "second row": "SECOND_ROW",
  second_row: "SECOND_ROW",
  "loose forward": "LOOSE_FORWARD",
  loose_forward: "LOOSE_FORWARD",
};

/** Known utility players mapped to their primary SL position */
const UTILITY_PLAYER_OVERRIDES: Record<string, Position> = {
  "hull-kr-hist-graeme-horne": "CENTRE",
};

export function isUtilityPosition(raw: string): boolean {
  const key = raw.trim().toLowerCase().replace(/_/g, " ");
  return key === "utility" || key === "utilities";
}

/**
 * Infer the best squad position for a utility player.
 * Priority: primaryPosition field → known overrides → stats heuristic → CENTRE default.
 */
export function inferUtilityPosition(
  raw: Record<string, unknown>
): Position {
  const primary = raw.primaryPosition as string | undefined;
  if (primary && !isUtilityPosition(primary)) {
    return normalizePosition(primary);
  }

  const id = raw.id as string | undefined;
  if (id && UTILITY_PLAYER_OVERRIDES[id]) {
    return UTILITY_PLAYER_OVERRIDES[id];
  }

  const appearances = (raw.appearances as number) ?? 0;
  const tries = (raw.tries as number) ?? 0;

  if (appearances > 0) {
    const tryRate = tries / appearances;
    // Back utility: meaningful try involvement
    if (tries >= 20 || tryRate >= 0.06) return "CENTRE";
    // Half utility
    if (tryRate >= 0.03 && tries >= 8) return "STAND_OFF";
    // Forward utility
    if (tries <= 5) return "LOOSE_FORWARD";
  }

  // Default: centre is the most common utility back role in Super League
  return "CENTRE";
}

export function normalizePosition(
  raw: string,
  context?: Record<string, unknown>
): Position {
  if (isUtilityPosition(raw)) {
    return context ? inferUtilityPosition(context) : "CENTRE";
  }

  const key = raw.trim().toLowerCase().replace(/_/g, " ");
  const mapped =
    POSITION_ALIASES[key] ?? POSITION_ALIASES[key.replace(/ /g, "-")];
  if (mapped) return mapped;

  const upper = raw.trim().toUpperCase().replace(/ /g, "_").replace(/-/g, "_");
  if (GAME_POSITIONS.includes(upper as Position)) {
    return upper as Position;
  }

  throw new Error(`Unknown position: ${raw}`);
}

export interface PositionNormalizationResult {
  position: Position;
  originalPosition?: string;
  mappedFromUtility: boolean;
}

export function resolvePosition(
  raw: Record<string, unknown>
): PositionNormalizationResult {
  const rawPosition = (raw.position as string) ?? "";

  if (isUtilityPosition(rawPosition)) {
    return {
      position: inferUtilityPosition(raw),
      originalPosition: rawPosition,
      mappedFromUtility: true,
    };
  }

  return {
    position: normalizePosition(rawPosition, raw),
    mappedFromUtility: false,
  };
}
