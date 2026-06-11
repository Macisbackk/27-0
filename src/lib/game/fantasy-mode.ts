import { getRecruitablePlayers } from "../players";
import type { Player, Position, SquadSlot } from "../types";
import { getSquadValue } from "../positions";
import { getAverageSquadRating } from "../squad-analysis";
import { getDraftCandidatePositions } from "./draft-positions";

export const FANTASY_BUDGET = 3_000_000;
export const FANTASY_SQUAD_SIZE = 13;
export const FANTASY_SEASON_ROUNDS = 27;

/** Prop ↔ second row swaps allowed in Fantasy Mode (no OVR penalty). */
const FANTASY_CROSS_POSITION: Partial<Record<Position, Position[]>> = {
  PROP: ["SECOND_ROW"],
  SECOND_ROW: ["PROP"],
};

/** Eligible pool: current, historic, legends — excludes hidden/easter-egg/unavailable. */
export function getFantasyEligiblePlayers(): Player[] {
  return getRecruitablePlayers();
}

export function getFantasyEligiblePositions(slotPosition: Position): Position[] {
  const positions = new Set(getDraftCandidatePositions(slotPosition));
  for (const extra of FANTASY_CROSS_POSITION[slotPosition] ?? []) {
    positions.add(extra);
  }
  return [...positions];
}

export function isFantasyEligibleForSlot(
  playerPosition: Position,
  slotPosition: Position
): boolean {
  return getFantasyEligiblePositions(slotPosition).includes(playerPosition);
}

export function getFantasyBudgetRemaining(
  squad: SquadSlot[],
  budget = FANTASY_BUDGET
): number {
  return budget - getSquadValue(squad);
}

/** Budget available when signing into a slot (includes refund of current occupant). */
export function getFantasyBudgetForSlot(
  squad: SquadSlot[],
  slot: SquadSlot,
  budget = FANTASY_BUDGET
): number {
  return getFantasyBudgetRemaining(squad, budget) + (slot.player?.value ?? 0);
}

export function canAffordPlayerForSlot(
  squad: SquadSlot[],
  slot: SquadSlot,
  player: Player,
  budget = FANTASY_BUDGET
): boolean {
  return player.value <= getFantasyBudgetForSlot(squad, slot, budget);
}

export function canAffordPlayer(
  squad: SquadSlot[],
  player: Player,
  budget = FANTASY_BUDGET
): boolean {
  return player.value <= getFantasyBudgetRemaining(squad, budget);
}

export function isPlayerInSquad(squad: SquadSlot[], playerId: string): boolean {
  return squad.some((s) => s.player?.id === playerId);
}

export function getSignedPlayerIds(squad: SquadSlot[]): Set<string> {
  return new Set(
    squad.filter((s) => s.player).map((s) => s.player!.id)
  );
}

/** Players eligible for a slot — position-compatible, not already signed, within budget. */
export function getFantasyCandidatesForSlot(
  squad: SquadSlot[],
  slot: SquadSlot,
  pool = getFantasyEligiblePlayers()
): Player[] {
  const signedIds = getSignedPlayerIds(squad);
  const currentPlayer = slot.player;
  const budgetRemaining = getFantasyBudgetForSlot(squad, slot);
  const positions = getFantasyEligiblePositions(slot.position);

  return pool.filter((player) => {
    if (signedIds.has(player.id) && player.id !== currentPlayer?.id) {
      return false;
    }
    if (!positions.includes(player.position)) return false;
    return player.value <= budgetRemaining;
  });
}

export function signFantasyPlayerToSlot(
  squad: SquadSlot[],
  player: Player,
  slotIndex: number
): SquadSlot[] {
  const slot = squad.find((s) => s.slotIndex === slotIndex);
  if (!slot) return squad;
  if (!isFantasyEligibleForSlot(player.position, slot.position)) return squad;

  return squad.map((s) => {
    if (s.slotIndex === slotIndex) {
      return {
        ...s,
        player,
        runRatingPenalty: undefined,
      };
    }
    return s;
  });
}

export function clearFantasySlot(
  squad: SquadSlot[],
  slotIndex: number
): SquadSlot[] {
  return squad.map((s) =>
    s.slotIndex === slotIndex
      ? { ...s, player: null, runRatingPenalty: undefined }
      : s
  );
}

export function getFantasySquadSummary(squad: SquadSlot[]) {
  return {
    totalValue: getSquadValue(squad),
    budgetRemaining: getFantasyBudgetRemaining(squad),
    averageRating: getAverageSquadRating(squad),
  };
}
