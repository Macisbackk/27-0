import { createEmptySquad, signPlayerToSlot, TOTAL_SLOTS } from "../positions";
import { getSuperSamHallasPlayer } from "../players/super-sam-hallas";
import type { SquadSlot } from "../types";

export const ALL_SUPER_SAM_SLOT_INDICES = Array.from(
  { length: TOTAL_SLOTS },
  (_, i) => i
);

export function createSuperSamHallasStartingSquad(): SquadSlot[] {
  let squad = createEmptySquad();
  for (const slot of squad) {
    const sam = getSuperSamHallasPlayer(slot.slotIndex, slot.position);
    squad = signPlayerToSlot(squad, sam, slot.slotIndex);
  }
  return squad;
}

export function isSuperSamHallasLockedSlot(_slotIndex: number): boolean {
  return true;
}
