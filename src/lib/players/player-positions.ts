import type { Player, Position } from "../types";
import { POSITION_SHORT } from "../positions";
import { normalizePosition } from "./position-utils";

const ABBREV_TO_POSITION: Record<string, Position> = {
  FB: "FULLBACK",
  WG: "WING",
  CE: "CENTRE",
  SO: "STAND_OFF",
  SH: "SCRUM_HALF",
  PF: "PROP",
  HK: "HOOKER",
  SR: "SECOND_ROW",
  LF: "LOOSE_FORWARD",
};

/** Parse compact position codes (e.g. CE/WG, HB/HK) into game positions. */
export function parsePositionAbbreviations(abbrev: string): Position[] {
  const parts = abbrev.split("/").map((s) => s.trim().toUpperCase());
  const positions = new Set<Position>();

  for (const part of parts) {
    if (part === "HB") {
      positions.add("STAND_OFF");
      positions.add("SCRUM_HALF");
      continue;
    }
    const mapped = ABBREV_TO_POSITION[part];
    if (!mapped) {
      throw new Error(`Unknown position abbreviation: ${part}`);
    }
    positions.add(mapped);
  }

  return [...positions];
}

export const OUT_OF_POSITION_PENALTY = 5;

/** Pairs that may fill each other's slots without an OVR penalty. */
const COMPATIBLE_PAIRS: [Position, Position][] = [
  ["WING", "FULLBACK"],
  ["STAND_OFF", "SCRUM_HALF"],
  ["PROP", "SECOND_ROW"],
];

export function arePositionsCompatible(a: Position, b: Position): boolean {
  if (a === b) return true;
  return COMPATIBLE_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}

type PositionEligibilityPlayer = Pick<
  Player,
  "position" | "positions" | "primaryPosition" | "teamYearId" | "runClub"
> & {
  id?: string;
};

function parsePrimaryPositionAbbrev(
  abbrev: string | undefined
): Position[] {
  if (!abbrev?.trim()) return [];
  const parts = abbrev.split("/").map((s) => s.trim()).filter(Boolean);
  const positions = new Set<Position>();

  for (const part of parts) {
    try {
      if (/^(HB|HK|[A-Z]{2,3})$/i.test(part)) {
        for (const pos of parsePositionAbbreviations(part.toUpperCase())) {
          positions.add(pos);
        }
      } else {
        positions.add(normalizePosition(part));
      }
    } catch {
      // ignore invalid segment
    }
  }

  return [...positions];
}

function collectEligiblePositions(
  player: PositionEligibilityPlayer
): Set<Position> {
  const collected = new Set<Position>();
  collected.add(player.position);

  for (const pos of player.positions ?? []) {
    collected.add(pos);
  }

  for (const pos of parsePrimaryPositionAbbrev(player.primaryPosition)) {
    collected.add(pos);
  }

  if (
    collected.size <= 1 &&
    (player.position === "SCRUM_HALF" || player.position === "STAND_OFF")
  ) {
    collected.add("SCRUM_HALF");
    collected.add("STAND_OFF");
  }

  return collected;
}

function parseRunClubTeamYear(
  runClub: string
): { team: string; year: string } | null {
  const match = runClub.match(/^(.+?)\s+'(\d{2})$/);
  if (!match) return null;
  return { team: match[1]!.trim(), year: `20${match[2]}` };
}

function resolveTeamYearContext(
  player: PositionEligibilityPlayer
): { team: string; year: string } | null {
  if (player.teamYearId) {
    const { getTeamYearPoolById } =
      require("../game/team-year-pools") as typeof import("../game/team-year-pools");
    const pool = getTeamYearPoolById(player.teamYearId);
    if (pool) return { team: pool.team, year: pool.year };
  }

  if (player.runClub) {
    return parseRunClubTeamYear(player.runClub);
  }

  return null;
}

/** Merge registry + team-year wiki roles so squad snapshots keep full dual eligibility. */
export function resolvePlacementPlayer(player: Player): Player {
  let merged = { ...player };
  const collected = collectEligiblePositions(player);

  if (player.id) {
    const { getPlayerById } =
      require("./index") as typeof import("./index");
    const registry = getPlayerById(player.id);
    if (registry) {
      for (const pos of collectEligiblePositions(registry)) {
        collected.add(pos);
      }
      merged = {
        ...registry,
        ...player,
        position: player.position ?? registry.position,
        primaryPosition: player.primaryPosition ?? registry.primaryPosition,
      };
    }
  }

  const teamYear = resolveTeamYearContext(merged);
  if (teamYear) {
    const { getTeamYearRecruitPositions } =
      require("./team-year-roster-playable") as typeof import("./team-year-roster-playable");
    for (const pos of getTeamYearRecruitPositions(
      teamYear.team,
      teamYear.year,
      merged
    )) {
      collected.add(pos);
    }
  }

  return {
    ...merged,
    positions: [...collected],
  };
}

/** All positions a player may fill — dual roles, primaryPosition abbrev, legacy halfback pair. */
export function getEligiblePositions(
  player: PositionEligibilityPlayer
): Position[] {
  return [...collectEligiblePositions(player)];
}

/** @deprecated Use getEligiblePositions — kept for existing imports. */
export function getPlayerEligiblePositions(player: Player): Position[] {
  return getEligiblePositions(player);
}

export function canPlayPosition(
  player: PositionEligibilityPlayer,
  selectedPosition: Position
): boolean {
  return getEligiblePositions(player).includes(selectedPosition);
}

function isPenaltyFreePlacementInternal(
  profile: PositionEligibilityPlayer,
  slotPosition: Position
): boolean {
  const eligible = getEligiblePositions(profile);

  if (eligible.includes(slotPosition)) return true;
  if (arePositionsCompatible(profile.position, slotPosition)) return true;
  return eligible.some(
    (pos) =>
      pos === slotPosition || arePositionsCompatible(pos, slotPosition)
  );
}

/** True when a player may occupy a slot at full OVR (listed role or cross-slot pair). */
export function isPenaltyFreePlacement(
  player: PositionEligibilityPlayer,
  slotPosition: Position
): boolean {
  const profile =
    "id" in player && player.id
      ? resolvePlacementPlayer(player as Player)
      : player;
  return isPenaltyFreePlacementInternal(profile, slotPosition);
}

export function applyOutOfPositionPenalty(
  rating: number,
  penalty = OUT_OF_POSITION_PENALTY
): number {
  return Math.max(75, rating - penalty);
}

export function getPlayerRatingForPosition(
  player: Player,
  selectedPosition: Position,
  _slotPenalty?: number
): number {
  const profile = resolvePlacementPlayer(player);
  if (isPenaltyFreePlacementInternal(profile, selectedPosition)) {
    return player.peakRating;
  }
  return applyOutOfPositionPenalty(player.peakRating, OUT_OF_POSITION_PENALTY);
}

export function playerEligibleForSlot(
  player: Player,
  slotPosition: Position,
  allowedSlotPositions: readonly Position[]
): boolean {
  const allowed = new Set(allowedSlotPositions);
  return getPlayerEligiblePositions(player).some((pos) => allowed.has(pos));
}

export function formatPositionAbbreviations(player: Player): string {
  const positions = getPlayerEligiblePositions(player);
  const abbrev = (pos: Position): string => {
    switch (pos) {
      case "FULLBACK":
        return "FB";
      case "WING":
        return "WG";
      case "CENTRE":
        return "CE";
      case "STAND_OFF":
        return "SO";
      case "SCRUM_HALF":
        return "SH";
      case "PROP":
        return "PF";
      case "HOOKER":
        return "HK";
      case "SECOND_ROW":
        return "SR";
      case "LOOSE_FORWARD":
        return "LF";
    }
  };

  const labels = positions.map(abbrev);
  if (
    labels.includes("SO") &&
    labels.includes("SH") &&
    labels.length === 2
  ) {
    return "HB";
  }
  return labels.join("/");
}

export function formatPlayerPositionLabel(player: Player): string {
  const positions = getPlayerEligiblePositions(player);
  if (positions.length <= 1) {
    return POSITION_SHORT[player.position];
  }
  return formatPositionAbbreviations(player);
}
