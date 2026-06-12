import { getRecruitablePlayers } from "../players";
import type { Player, Position, SquadSlot } from "../types";
import { getSquadValue, isSquadComplete } from "../positions";
import { getAverageSquadRating } from "../squad-analysis";
import { getDraftCandidatePositions } from "./draft-positions";

export type FantasySortKey =
  | "rating-desc"
  | "rating-asc"
  | "value-desc"
  | "value-asc";

export interface FantasyPickerFilters {
  search: string;
  club: string;
  sortKey: FantasySortKey;
  affordableOnly: boolean;
}

export const DEFAULT_FANTASY_PICKER_FILTERS: FantasyPickerFilters = {
  search: "",
  club: "all",
  sortKey: "rating-desc",
  affordableOnly: false,
};

export const FANTASY_AUTOFILL_ERROR =
  "Not enough budget to autofill remaining positions. Remove a player or choose cheaper options.";

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

function getMinReserveBudget(
  squad: SquadSlot[],
  currentSlotIndex: number,
  emptySlots: SquadSlot[],
  pool: Player[]
): number {
  const signedIds = getSignedPlayerIds(squad);
  let total = 0;

  for (const slot of emptySlots) {
    if (slot.slotIndex === currentSlotIndex) continue;
    const positions = getFantasyEligiblePositions(slot.position);
    let cheapest = Infinity;

    for (const player of pool) {
      if (signedIds.has(player.id)) continue;
      if (!positions.includes(player.position)) continue;
      cheapest = Math.min(cheapest, player.value);
    }

    if (cheapest === Infinity) return Infinity;
    total += cheapest;
  }

  return total;
}

function pickAutofillCandidate(candidates: Player[]): Player {
  const scored = candidates.map((player) => ({
    player,
    score: (player.peakRating * player.peakRating) / player.value,
  }));
  scored.sort((a, b) => b.score - a.score);

  const pool = scored.slice(0, Math.min(10, scored.length));
  const weights = pool.map(({ score }) => Math.max(score, 0.0001));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].player;
  }

  return pool[pool.length - 1].player;
}

/** Fill all empty slots within budget, or return a clear error without partial apply. */
export function autofillFantasySquad(
  squad: SquadSlot[],
  pool = getFantasyEligiblePlayers(),
  budget = FANTASY_BUDGET
): { success: true; squad: SquadSlot[] } | { success: false; message: string } {
  let working = squad.map((slot) => ({ ...slot }));
  const emptySlots = working.filter((slot) => !slot.player);

  if (emptySlots.length === 0) {
    return { success: true, squad: working };
  }

  const orderedSlots = [...emptySlots].sort((a, b) => {
    const countA = getFantasyCandidatesForSlot(working, a, pool).length;
    const countB = getFantasyCandidatesForSlot(working, b, pool).length;
    return countA - countB || a.slotIndex - b.slotIndex;
  });

  for (const slot of orderedSlots) {
    const remainingEmpty = working.filter((s) => !s.player);
    const reserve = getMinReserveBudget(
      working,
      slot.slotIndex,
      remainingEmpty,
      pool
    );
    const slotBudget = getFantasyBudgetForSlot(working, slot, budget);
    const maxPay = slotBudget - reserve;

    const candidates = getFantasyCandidatesForSlot(working, slot, pool).filter(
      (player) => player.value <= maxPay
    );

    if (candidates.length === 0) {
      return { success: false, message: FANTASY_AUTOFILL_ERROR };
    }

    const picked = pickAutofillCandidate(candidates);
    working = signFantasyPlayerToSlot(working, picked, slot.slotIndex);
  }

  if (
    !isSquadComplete(working) ||
    getFantasyBudgetRemaining(working, budget) < 0
  ) {
    return { success: false, message: FANTASY_AUTOFILL_ERROR };
  }

  return { success: true, squad: working };
}
