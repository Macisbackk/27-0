import { getJoeMellorGoatPlayer } from "../players/goat";
import { JOE_MELLOR_GOAT_ID } from "../players/goat";
import {
  createEmptySquad,
  LOOSE_FORWARD_SLOT_INDEX,
  signPlayerToSlot,
} from "../positions";
import type { SquadSlot } from "../types";

export { JOE_MELLOR_GOAT_ID };

export function createJoeMellorStartingSquad(): SquadSlot[] {
  const squad = createEmptySquad();
  const joe = getJoeMellorGoatPlayer();
  return signPlayerToSlot(squad, joe, LOOSE_FORWARD_SLOT_INDEX);
}

export function isJoeMellorLockedSlot(slotIndex: number): boolean {
  return slotIndex === LOOSE_FORWARD_SLOT_INDEX;
}
