import type { Player, Position, SquadSlot } from "../types";
import { getPlayerEligiblePositions } from "../players/player-positions";
import { getPlacementPenalty } from "./position-placement";
import { signPlayerToSlot } from "../positions";

export function canBenchPlayerFillSlot(
  player: Player,
  slotPosition: Position
): boolean {
  return getPlayerEligiblePositions(player).includes(slotPosition);
}

export function swapCupSquadPlayers(
  squad: SquadSlot[],
  starterSlotIndex: number,
  benchPlayer: Player
): SquadSlot[] | null {
  const starterSlot = squad.find((s) => s.slotIndex === starterSlotIndex);
  if (!starterSlot?.player) return null;
  if (!canBenchPlayerFillSlot(benchPlayer, starterSlot.position)) return null;

  const penalty = getPlacementPenalty(
    benchPlayer.position,
    starterSlot.position,
    benchPlayer
  );

  return signPlayerToSlot(squad, benchPlayer, starterSlotIndex, penalty);
}
