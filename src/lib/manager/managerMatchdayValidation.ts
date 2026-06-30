import { getManagerPlayer, getManagerPlayerEligiblePositions } from "./managerPlayers";
import { POSITION_LABELS, POSITION_SHORT, SQUAD_STRUCTURE } from "../positions";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_STARTING_17_SIZE,
  ERA_XIII_FROM_STARTING_17,
} from "../players/era-starting-17s";
import { isPlayerUnavailable, validateMatchdaySquad } from "./managerSquad";

export interface MatchdayValidationResult {
  valid: boolean;
  message: string;
  missing: string[];
}

function countFilled(ids: string[]): number {
  return ids.filter((id) => id && id.length > 0).length;
}

function canPlayPositionForCareer(
  career: ManagerCareer,
  playerId: string,
  position: Position
): boolean {
  return getManagerPlayerEligiblePositions(career, playerId).includes(
    position
  );
}

export function validateFitMatchdaySquad(
  career: ManagerCareer
): MatchdayValidationResult {
  const missing: string[] = [];
  const squadById = new Map(career.squad.map((p) => [p.playerId, p]));

  const xiiiFilled = countFilled(career.matchdayXiii);
  if (xiiiFilled < ERA_XIII_FROM_STARTING_17) {
    missing.push(
      `${ERA_XIII_FROM_STARTING_17 - xiiiFilled} starter${ERA_XIII_FROM_STARTING_17 - xiiiFilled === 1 ? "" : "s"}`
    );
  }

  const benchFilled = countFilled(career.matchdayInterchange);
  if (benchFilled < ERA_BENCH_FROM_STARTING_17) {
    missing.push(
      `${ERA_BENCH_FROM_STARTING_17 - benchFilled} interchange player${ERA_BENCH_FROM_STARTING_17 - benchFilled === 1 ? "" : "s"}`
    );
  }

  const allIds = [
    ...career.matchdayXiii.filter(Boolean),
    ...career.matchdayInterchange.filter(Boolean),
  ];

  for (const id of allIds) {
    const ps = squadById.get(id);
    const reserve = career.reserves.find((r) => r.id === id);
    const player = getManagerPlayer(career, id);
    if (!player) {
      missing.push("invalid squad selection");
      continue;
    }
    if (ps && isPlayerUnavailable(ps)) {
      missing.push(`${player.name} (unavailable)`);
    }
    if (reserve && reserve.fitness < 50) {
      missing.push(`${player.name} (not fit)`);
    }
  }

  for (let i = 0; i < career.matchdayXiii.length; i++) {
    const id = career.matchdayXiii[i];
    const pos = career.xiiiSlotPositions[i];
    if (!id || !pos) continue;
    if (!canPlayPositionForCareer(career, id, pos)) {
      const player = getManagerPlayer(career, id);
      missing.push(
        `${player?.name ?? "Player"} cannot play ${POSITION_SHORT[pos]}`
      );
    }
  }

  const required: Partial<Record<Position, number>> = {};
  for (const { position, count } of SQUAD_STRUCTURE) {
    required[position] = count;
  }
  const filled: Partial<Record<Position, number>> = {};
  for (let i = 0; i < career.xiiiSlotPositions.length; i++) {
    const id = career.matchdayXiii[i];
    const pos = career.xiiiSlotPositions[i];
    if (!id || !pos || !canPlayPositionForCareer(career, id, pos)) continue;
    filled[pos] = (filled[pos] ?? 0) + 1;
  }
  for (const [pos, need] of Object.entries(required)) {
    const have = filled[pos as Position] ?? 0;
    if (have < need) {
      const short = need - have;
      missing.push(
        `${short} ${POSITION_LABELS[pos as Position].toLowerCase()}${short > 1 ? "s" : ""}`
      );
    }
  }

  const formation = validateMatchdaySquad(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions
  );
  if (!formation.valid && formation.error) {
    missing.push(formation.error);
  }

  const unique = [...new Set(missing)];
  const hasCallUps = career.calledUpReserveIds.length > 0;

  if (
    xiiiFilled === ERA_XIII_FROM_STARTING_17 &&
    benchFilled === ERA_BENCH_FROM_STARTING_17 &&
    unique.length === 0 &&
    new Set(allIds).size === ERA_STARTING_17_SIZE &&
    formation.valid
  ) {
    return { valid: true, message: "", missing: [] };
  }

  let message = `You cannot play this match yet. Your matchday squad needs 17 fit players.`;
  if (unique.length > 0) {
    message += `\nMissing: ${unique.join(", ")}.`;
  }
  if (!hasCallUps && unique.length > 0) {
    message += "\nCall up reserves or change your squad before playing.";
  }

  return { valid: false, message, missing: unique };
}
