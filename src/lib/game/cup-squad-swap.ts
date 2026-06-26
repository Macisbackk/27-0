import type { Player, Position, SquadSlot } from "../types";
import {
  arePositionsCompatible,
  getEligiblePositions,
} from "../players/player-positions";
import {
  getPlacementPenalty,
  isValidPlayerSlotPosition,
} from "./position-placement";
import { getTeamYearRecruitPositions } from "../players/team-year-roster-playable";
import { signPlayerToSlot } from "../positions";

export type CupBenchSwapContext = {
  club?: string;
  year?: string;
  benchListedPosition?: Position;
};

/** Positions a bench player may fill when swapping into the starting XIII. */
export function getCupBenchEligiblePositions(
  player: Player,
  context?: CupBenchSwapContext
): Position[] {
  const positions = new Set(getEligiblePositions(player));

  if (context?.benchListedPosition) {
    positions.add(context.benchListedPosition);
  }

  if (context?.club && context?.year) {
    for (const pos of getTeamYearRecruitPositions(
      context.club,
      context.year,
      player
    )) {
      positions.add(pos);
    }
  }

  return [...positions];
}

export function canBenchPlayerFillSlot(
  player: Player,
  slotPosition: Position,
  context?: CupBenchSwapContext
): boolean {
  const eligible = getCupBenchEligiblePositions(player, context);
  if (eligible.includes(slotPosition)) return true;
  if (eligible.some((pos) => arePositionsCompatible(pos, slotPosition))) {
    return true;
  }
  return isValidPlayerSlotPosition(player, slotPosition);
}

export function swapCupSquadPlayers(
  squad: SquadSlot[],
  starterSlotIndex: number,
  benchPlayer: Player,
  context?: CupBenchSwapContext
): SquadSlot[] | null {
  const starterSlot = squad.find((s) => s.slotIndex === starterSlotIndex);
  if (!starterSlot?.player) return null;
  if (!canBenchPlayerFillSlot(benchPlayer, starterSlot.position, context)) {
    return null;
  }

  const penalty = getPlacementPenalty(
    benchPlayer.position,
    starterSlot.position,
    benchPlayer
  );

  return signPlayerToSlot(squad, benchPlayer, starterSlotIndex, penalty);
}
