import { getRecruitablePlayers } from "../players";
import type { Player, Position, SquadSlot } from "../types";
import { getSquadValue, isSquadComplete } from "../positions";
import { getAverageSquadRating } from "../squad-analysis";
import { getPlayerEligiblePositions } from "../players/player-positions";
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
  player: Player,
  slotPosition: Position
): boolean {
  const positions = getFantasyEligiblePositions(slotPosition);
  return getPlayerEligiblePositions(player).some((pos) => positions.includes(pos));
}

/** @deprecated Use isFantasyEligibleForSlot(player, slotPosition) */
export function isFantasyEligibleForPlayerPosition(
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
    if (!isFantasyEligibleForSlot(player, slot.position)) return false;
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
  if (!isFantasyEligibleForSlot(player, slot.position)) return squad;

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

function percentileCost(costs: number[], ratio: number): number {
  if (costs.length === 0) return Infinity;
  const sorted = [...costs].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * ratio))
  );
  return sorted[index];
}

/** Reserve a fair share per remaining slot — softer than absolute-cheapest only. */
function getReserveBudget(
  squad: SquadSlot[],
  currentSlotIndex: number,
  emptySlots: SquadSlot[],
  pool: Player[],
  budget: number
): number {
  const others = emptySlots.filter((slot) => slot.slotIndex !== currentSlotIndex);
  if (others.length === 0) return 0;

  const signedIds = getSignedPlayerIds(squad);
  const budgetRemaining = getFantasyBudgetRemaining(squad, budget);
  const fairShare = budgetRemaining / (others.length + 1);
  let total = 0;

  for (const slot of others) {
    const positions = getFantasyEligiblePositions(slot.position);
    const costs: number[] = [];

    for (const player of pool) {
      if (signedIds.has(player.id)) continue;
      if (!isFantasyEligibleForSlot(player, slot.position)) continue;
      costs.push(player.value);
    }

    if (costs.length === 0) return Infinity;

    const lowerQuartile = percentileCost(costs, 0.25);
    total += Math.min(lowerQuartile, fairShare * 1.15);
  }

  return total;
}

function pickAutofillCandidate(candidates: Player[], maxPay: number): Player {
  if (candidates.length === 0) {
    throw new Error("No autofill candidates");
  }
  if (candidates.length === 1) return candidates[0];

  const ratings = candidates.map((player) => player.peakRating);
  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);

  const weighted = candidates.map((player) => {
    const ratingNorm =
      maxRating === minRating
        ? 1
        : (player.peakRating - minRating) / (maxRating - minRating);

    const spendRatio = maxPay > 0 ? player.value / maxPay : 1;
    const budgetFit = 1 - Math.min(1, Math.abs(spendRatio - 0.6) * 0.9);
    const valueEfficiency = player.peakRating / Math.max(player.value / 50_000, 1);
    const jitter = 0.7 + Math.random() * 0.6;

    const weight =
      (Math.pow(ratingNorm, 0.75) * 4 +
        (player.peakRating / 100) * 1.5 +
        budgetFit * 1.2 +
        Math.min(valueEfficiency, 3) * 0.35) *
      jitter;

    return { player, weight: Math.max(weight, 0.01) };
  });

  const sorted = [...weighted].sort((a, b) => b.weight - a.weight);
  const poolSize = Math.min(
    sorted.length,
    Math.max(6, Math.ceil(sorted.length * 0.45))
  );
  const pool = sorted.slice(0, poolSize);
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.player;
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
    const reserve = getReserveBudget(
      working,
      slot.slotIndex,
      remainingEmpty,
      pool,
      budget
    );
    const slotBudget = getFantasyBudgetForSlot(working, slot, budget);
    const maxPay = Math.max(0, slotBudget - reserve);

    const candidates = getFantasyCandidatesForSlot(working, slot, pool).filter(
      (player) => player.value <= maxPay
    );

    if (candidates.length === 0 || maxPay <= 0) {
      return { success: false, message: FANTASY_AUTOFILL_ERROR };
    }

    const picked = pickAutofillCandidate(candidates, maxPay);
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
