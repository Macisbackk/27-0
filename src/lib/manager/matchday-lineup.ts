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

/** Mild OOP-style penalty when fitness is low after injury / heavy minutes. */
export function getManagerFitnessRatingPenalty(
  career: ManagerCareer,
  playerId: string
): number {
  const ps = career.squad.find((p) => p.playerId === playerId);
  const fitness =
    ps?.fitness ??
    career.reserves.find((r) => r.id === playerId)?.fitness ??
    90;
  if (fitness >= 82) return 0;
  return Math.min(6, Math.round((82 - fitness) * 0.25));
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
    const penalty = career ? getManagerFitnessRatingPenalty(career, id) : 0;
    squad = signPlayerToSlot(squad, player, i, penalty);
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
  const xiiiIds = Array.from({ length: XIII_SLOTS }, (_, slotIndex) => {
    return lineup.xiii[slotIndex]?.player.id ?? "";
  });
  const slotPositions = Array.from({ length: XIII_SLOTS }, (_, slotIndex) => {
    return lineup.xiii[slotIndex]?.position ?? getFormationSlotPosition(slotIndex);
  });
  return toMatchdaySquadSlots({ xiiiIds, slotPositions, career });
}
