import type { Player, Position, SquadSlot } from "../types";
import { RECRUIT_SLOT_ORDER } from "../positions";

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

/** Pick the best empty slot for a signed player (natural position first, then compat). */
export function findBestSlotForPlayer(
  squad: SquadSlot[],
  player: Player
): { slotIndex: number; penalty: number } | null {
  const emptySlots = squad.filter((slot) => !slot.player);
  if (emptySlots.length === 0) return null;

  const scored = emptySlots.map((slot) => {
    const penalty = getPlacementPenalty(player.position, slot.position);
    const recruitOrder = RECRUIT_SLOT_ORDER.indexOf(
      slot.slotIndex as (typeof RECRUIT_SLOT_ORDER)[number]
    );
    return {
      slot,
      penalty,
      isNatural: player.position === slot.position,
      recruitOrder: recruitOrder >= 0 ? recruitOrder : slot.slotIndex + 100,
    };
  });

  scored.sort((a, b) => {
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1;
    return a.recruitOrder - b.recruitOrder;
  });

  const best = scored[0];
  if (!best) return null;
  return { slotIndex: best.slot.slotIndex, penalty: best.penalty };
}
