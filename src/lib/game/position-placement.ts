import type { Position } from "../types";

export const OUT_OF_POSITION_PENALTY = 5;

/** Pairs that may swap without a run penalty. */
const COMPATIBLE_PAIRS: [Position, Position][] = [
  ["WING", "FULLBACK"],
  ["STAND_OFF", "SCRUM_HALF"],
  ["PROP", "SECOND_ROW"],
];

function isCompatible(a: Position, b: Position): boolean {
  if (a === b) return true;
  return COMPATIBLE_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}

export function getPlacementPenalty(
  naturalPosition: Position,
  slotPosition: Position
): number {
  return isCompatible(naturalPosition, slotPosition)
    ? 0
    : OUT_OF_POSITION_PENALTY;
}

export function isNaturalPlacement(
  naturalPosition: Position,
  slotPosition: Position
): boolean {
  return naturalPosition === slotPosition;
}
