import type { Player, Position } from "../types";
import { POSITION_SHORT } from "../positions";

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

/** All squad slots a player may fill (dual positions + legacy halfback pair). */
export function getPlayerEligiblePositions(player: Player): Position[] {
  if (player.positions?.length) {
    return [...new Set(player.positions)];
  }

  if (player.position === "SCRUM_HALF" || player.position === "STAND_OFF") {
    return ["SCRUM_HALF", "STAND_OFF"];
  }

  return [player.position];
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
