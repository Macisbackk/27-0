import { SQUAD_STRUCTURE } from "../positions";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "./managerPlayers";
import { canAffordAdditionalWage } from "./managerFinance";
import { getTransferDemand } from "./managerTransfers";

export type TransferPriorityFilter =
  | "all"
  | "squad-needs"
  | "cap-space"
  | "expiring";

export const TRANSFER_PRIORITY_LABELS: Record<
  TransferPriorityFilter,
  string
> = {
  all: "All targets",
  "squad-needs": "Squad needs",
  "cap-space": "Within wage cap",
  "expiring": "Replace expiring",
};

/** Positions where the senior squad has fewer cover than the ideal structure. */
export function getSquadNeedPositions(career: ManagerCareer): Position[] {
  const cover = new Map<Position, number>();
  for (const slot of SQUAD_STRUCTURE) {
    cover.set(slot.position, 0);
  }

  for (const ps of career.squad) {
    if (ps.injury?.matchesRemaining) continue;
    for (const pos of getManagerPlayerEligiblePositions(career, ps.playerId)) {
      cover.set(pos, (cover.get(pos) ?? 0) + 1);
    }
  }

  const needs: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    if ((cover.get(position) ?? 0) < count) {
      needs.push(position);
    }
  }
  return needs;
}

/** Positions held by players whose contracts expire this season. */
export function getExpiringContractPositions(
  career: ManagerCareer
): Position[] {
  const positions = new Set<Position>();
  for (const [playerId, contract] of Object.entries(career.contracts)) {
    if (contract.yearsRemaining > 1 && !contract.expiresAtSeasonEnd) continue;
    const player = getManagerPlayer(career, playerId);
    if (player) positions.add(player.position);
  }
  return [...positions];
}

export function playerMatchesTransferPriority(
  career: ManagerCareer,
  playerId: string,
  filter: TransferPriorityFilter
): boolean {
  if (filter === "all") return true;

  const player = getManagerPlayer(career, playerId);
  if (!player) return false;
  const eligible = getManagerPlayerEligiblePositions(career, playerId);

  if (filter === "squad-needs") {
    const needs = getSquadNeedPositions(career);
    return needs.some((pos) => eligible.includes(pos));
  }

  if (filter === "cap-space") {
    const demand = getTransferDemand(career, playerId);
    return canAffordAdditionalWage(career, demand.wagePerYear);
  }

  if (filter === "expiring") {
    const expiringPositions = getExpiringContractPositions(career);
    return expiringPositions.some((pos) => eligible.includes(pos));
  }

  return true;
}
