import type { Player, Position, SquadSlot } from "../types";
import { RECRUIT_SLOT_ORDER } from "../positions";
import { getPlayerEligiblePositions } from "../players/player-positions";

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

/** Player positions that can fill a slot without an out-of-position penalty. */
export function getCompatiblePlayerPositions(slotPosition: Position): Position[] {
  const positions = new Set<Position>([slotPosition]);
  for (const [a, b] of COMPATIBLE_PAIRS) {
    if (a === slotPosition) positions.add(b);
    if (b === slotPosition) positions.add(a);
  }
  return [...positions];
}

/** Union of player positions eligible for any remaining empty slot. */
export function getRemainingRecruitPlayerPositions(
  squad: SquadSlot[]
): Set<Position> {
  const eligible = new Set<Position>();
  for (const slot of squad) {
    if (!slot.player) {
      for (const pos of getCompatiblePlayerPositions(slot.position)) {
        eligible.add(pos);
      }
    }
  }
  return eligible;
}

/** Player positions that can still be recruited given empty natural slots (+ halfback). */
export function getRemainingNaturalPlayerPositions(
  squad: SquadSlot[]
): Set<Position> {
  const eligible = new Set<Position>();
  for (const slot of squad) {
    if (!slot.player) {
      eligible.add(slot.position);
      if (slot.position === "SCRUM_HALF" || slot.position === "STAND_OFF") {
        eligible.add("SCRUM_HALF");
        eligible.add("STAND_OFF");
      }
    }
  }
  return eligible;
}

/** Halfback positions that can fill each other's slots in Normal Mode recruitment. */
export function getHalfbackCompatiblePositions(
  playerPosition: Position
): Position[] {
  if (playerPosition === "SCRUM_HALF") return ["SCRUM_HALF", "STAND_OFF"];
  if (playerPosition === "STAND_OFF") return ["STAND_OFF", "SCRUM_HALF"];
  return [playerPosition];
}

/**
 * Player positions shown when recruiting for a specific slot (Normal Mode list filter).
 * SH/SO and Prop/SR pairs are cross-eligible; other slots are exact position only.
 */
export function getRecruitListPositionsForSlot(
  slotPosition: Position
): Position[] {
  if (slotPosition === "SCRUM_HALF" || slotPosition === "STAND_OFF") {
    return ["SCRUM_HALF", "STAND_OFF"];
  }
  if (slotPosition === "PROP" || slotPosition === "SECOND_ROW") {
    return ["PROP", "SECOND_ROW"];
  }
  return [slotPosition];
}

/** Empty slots where a player may be placed (natural position only + halfback swap). */
export function getNaturalPlacementSlots(
  squad: SquadSlot[],
  player: Player
): SquadSlot[] {
  const eligible = new Set(getPlayerEligiblePositions(player));
  return squad
    .filter((slot) => !slot.player && eligible.has(slot.position))
    .sort((a, b) => a.slotIndex - b.slotIndex);
}

/** First available natural slot for Normal Mode auto-placement. */
export function getFirstNaturalPlacementSlot(
  squad: SquadSlot[],
  player: Player
): SquadSlot | null {
  return getNaturalPlacementSlots(squad, player)[0] ?? null;
}

/** Whether a player's natural position (or halfback pair) has a remaining slot. */
export function canPlayerRecruitForRemainingSlots(
  player: Player,
  squad: SquadSlot[]
): boolean {
  return getNaturalPlacementSlots(squad, player).length > 0;
}

/** @deprecated Use canPlayerRecruitForRemainingSlots — slot recruit uses natural positions only. */
export function canPlayerFillAnyEmptySlot(
  squad: SquadSlot[],
  player: Player
): boolean {
  return canPlayerRecruitForRemainingSlots(player, squad);
}

/** True when the slot is one of the player's listed or eligible positions. */
export function isValidPlayerSlotPosition(
  player: Pick<Player, "position" | "positions">,
  slotPosition: Position
): boolean {
  if (player.positions?.length) {
    return player.positions.includes(slotPosition);
  }
  return getPlayerEligiblePositions(player as Player).includes(slotPosition);
}

export function getPlacementPenalty(
  naturalPosition: Position,
  slotPosition: Position,
  player?: Pick<Player, "position" | "positions">
): number {
  if (player) {
    return isValidPlayerSlotPosition(player, slotPosition)
      ? 0
      : OUT_OF_POSITION_PENALTY;
  }
  return isCompatible(naturalPosition, slotPosition)
    ? 0
    : OUT_OF_POSITION_PENALTY;
}

export function isNaturalPlacement(
  naturalPosition: Position,
  slotPosition: Position,
  player?: Pick<Player, "position" | "positions">
): boolean {
  if (player) {
    return isValidPlayerSlotPosition(player, slotPosition);
  }
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
    const eligible = getPlayerEligiblePositions(player);
    const penalty = getPlacementPenalty(player.position, slot.position, player);
    const recruitOrder = RECRUIT_SLOT_ORDER.indexOf(
      slot.slotIndex as (typeof RECRUIT_SLOT_ORDER)[number]
    );
    return {
      slot,
      penalty,
      isNatural: eligible.includes(slot.position),
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
