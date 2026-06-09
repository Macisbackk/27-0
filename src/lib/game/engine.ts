import { getPlayerById } from "../players";
import {
  canSignPlayer,
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  isSquadComplete,
  signPlayerToSquad,
  TOTAL_SLOTS,
} from "../positions";
import type { Player, RunState, SquadSlot } from "../types";

export function buildSquadFromIds(
  signedIds: string[],
  slots?: SquadSlot[]
): SquadSlot[] {
  let squad = slots ?? createEmptySquad();
  for (const id of signedIds) {
    const player = getPlayerById(id);
    if (player && canSignPlayer(squad, player.position)) {
      squad = signPlayerToSquad(squad, player);
    }
  }
  return squad;
}

export function getCurrentPlayer(
  sequence: string[],
  index: number
): Player | null {
  if (index >= sequence.length) return null;
  return getPlayerById(sequence[index]) ?? null;
}

export function buildRunState(
  runId: string,
  mode: "CLASSIC",
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED",
  sequence: string[],
  currentIndex: number,
  signedIds: string[],
  seed: string
): RunState {
  const squad = buildSquadFromIds(signedIds);
  const currentPlayer = status === "IN_PROGRESS" ? getCurrentPlayer(sequence, currentIndex) : null;

  return {
    id: runId,
    mode,
    status,
    currentPlayer,
    currentIndex,
    totalOffers: sequence.length,
    squad,
    totalValue: getSquadValue(squad),
    filledCount: getFilledCount(squad),
    totalSlots: TOTAL_SLOTS,
    canSign: currentPlayer ? canSignPlayer(squad, currentPlayer.position) : false,
    seed,
  };
}

export function findBestPlayer(squad: SquadSlot[]): { name: string; value: number } {
  let best = { name: "—", value: 0 };
  for (const slot of squad) {
    if (slot.player && slot.player.value > best.value) {
      best = { name: slot.player.name, value: slot.player.value };
    }
  }
  return best;
}

export function findBestPosition(squad: SquadSlot[]): { position: string; value: number } {
  let best = { position: "—", value: 0 };
  for (const slot of squad) {
    if (slot.player && slot.player.value > best.value) {
      best = { position: slot.label, value: slot.player.value };
    }
  }
  return best;
}

export function processSign(
  sequence: string[],
  currentIndex: number,
  signedIds: string[],
  squad: SquadSlot[]
): {
  newSignedIds: string[];
  newSquad: SquadSlot[];
  newIndex: number;
  completed: boolean;
  totalValue: number;
} {
  const player = getCurrentPlayer(sequence, currentIndex);
  if (!player || !canSignPlayer(squad, player.position)) {
    return {
      newSignedIds: signedIds,
      newSquad: squad,
      newIndex: currentIndex + 1,
      completed: isSquadComplete(squad),
      totalValue: getSquadValue(squad),
    };
  }

  const newSquad = signPlayerToSquad(squad, player);
  const newSignedIds = [...signedIds, player.id];
  const completed = isSquadComplete(newSquad);

  return {
    newSignedIds,
    newSquad,
    newIndex: currentIndex + 1,
    completed,
    totalValue: getSquadValue(newSquad),
  };
}

export function processSkip(
  sequence: string[],
  currentIndex: number,
  squad: SquadSlot[]
): {
  newIndex: number;
  completed: boolean;
} {
  const newIndex = currentIndex + 1;
  const completed = isSquadComplete(squad) || newIndex >= sequence.length;
  return { newIndex, completed };
}
