import {
  createEmptySquad,
  FORMATION_SLOT_POSITIONS,
  getFormationSlotPosition,
  signPlayerToSlot,
} from "../positions";
import { getPlayerById } from "../players";
import type { Position, SquadSlot } from "../types";
import type { ClubMatchdayLineup } from "./managerLeagueLineup";
import { getManagerPlayer } from "./managerPlayers";
import type { ManagerCareer } from "./types";
import { ERA_BENCH_FROM_STARTING_17, ERA_XIII_FROM_STARTING_17 } from "../players/era-starting-17s";

const XIII_SLOTS = ERA_XIII_FROM_STARTING_17;
const BENCH_SLOTS = ERA_BENCH_FROM_STARTING_17;

/** Fitness system removed — always returns 0 (no rating penalty). */
export function getManagerFitnessRatingPenalty(
  _career: ManagerCareer,
  _playerId: string
): number {
  return 0;
}

function padStringArray(values: string[] | undefined, length: number): string[] {
  const next = [...(values ?? [])];
  while (next.length < length) next.push("");
  return next.slice(0, length);
}

function normalizeSlotPositions(
  slotPositions: Position[] | undefined
): Position[] {
  if (slotPositions?.length === XIII_SLOTS) return [...slotPositions];
  return [...FORMATION_SLOT_POSITIONS];
}

/** Ensure matchday arrays are the correct length with canonical slot positions. */
export function normalizeMatchdayLineup(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    matchdayXiii: padStringArray(career.matchdayXiii, XIII_SLOTS),
    matchdayInterchange: padStringArray(career.matchdayInterchange, BENCH_SLOTS),
    xiiiSlotPositions: normalizeSlotPositions(career.xiiiSlotPositions),
  };
}

export interface MatchdaySquadSlotInput {
  xiiiIds: string[];
  slotPositions?: Position[];
  career?: ManagerCareer;
}

/** Single converter: slot-indexed XIII → RugbyPitch / TeamSheet squad slots. */
export function toMatchdaySquadSlots({
  xiiiIds,
  slotPositions = [...FORMATION_SLOT_POSITIONS],
  career,
}: MatchdaySquadSlotInput): SquadSlot[] {
  let squad = createEmptySquad();

  for (let i = 0; i < XIII_SLOTS; i++) {
    const position = slotPositions[i] ?? getFormationSlotPosition(i);
    squad = squad.map((slot) =>
      slot.slotIndex === i ? { ...slot, position } : slot
    );
  }

  for (let i = 0; i < Math.min(xiiiIds.length, XIII_SLOTS); i++) {
    const id = xiiiIds[i];
    if (!id) continue;
    const player = career ? getManagerPlayer(career, id) : getPlayerById(id);
    if (!player) continue;
    squad = signPlayerToSlot(squad, player, i, 0);
  }

  return squad;
}

export function toMatchdaySquadSlotsFromCareer(career: ManagerCareer): SquadSlot[] {
  const normalized = normalizeMatchdayLineup(career);
  return toMatchdaySquadSlots({
    xiiiIds: normalized.matchdayXiii,
    slotPositions: normalized.xiiiSlotPositions,
    career: normalized,
  });
}

export function toMatchdaySquadSlotsFromClubLineup(
  lineup: ClubMatchdayLineup,
  career?: ManagerCareer
): SquadSlot[] {
  let squad = createEmptySquad();
  const slotPositions = Array.from({ length: XIII_SLOTS }, (_, slotIndex) => {
    return lineup.xiii[slotIndex]?.position ?? getFormationSlotPosition(slotIndex);
  });

  for (let i = 0; i < XIII_SLOTS; i++) {
    const position = slotPositions[i] ?? getFormationSlotPosition(i);
    squad = squad.map((slot) =>
      slot.slotIndex === i ? { ...slot, position } : slot
    );
  }

  for (let i = 0; i < XIII_SLOTS; i++) {
    const row = lineup.xiii[i];
    if (!row?.player) continue;
    // Prefer the inline player object so emergency / ephemeral AI players render.
    const resolved = row.player;
    squad = signPlayerToSlot(squad, resolved, i, 0);
  }

  return squad;
}
