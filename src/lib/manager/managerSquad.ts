import type { Position, SquadSlot } from "../types";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  SQUAD_STRUCTURE,
  POSITION_SHORT,
} from "../positions";
import type { ManagerCareer, ManagerPlayerState } from "./types";
import { getManagerPlayer, getManagerPlayerEligiblePositions } from "./managerPlayers";
import { getMatchdayTryWeight } from "./managerTryScoring";
import {
  getManagerFitnessRatingPenalty,
  toMatchdaySquadSlots,
} from "./matchday-lineup";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_STARTING_17_SIZE,
  ERA_XIII_FROM_STARTING_17,
} from "../players/era-starting-17s";

export function createInitialPlayerState(playerId: string): ManagerPlayerState {
  return {
    playerId,
    form: 50 + Math.floor(Math.random() * 20),
    fitness: 85 + Math.floor(Math.random() * 15),
    injury: null,
    seasonAppearances: 0,
    seasonTries: 0,
  };
}

export function isPlayerUnavailable(player: ManagerPlayerState): boolean {
  return !!(player.injury && player.injury.matchesRemaining > 0);
}

export function getUnavailableSquadPlayers(
  career: ManagerCareer
): ManagerPlayerState[] {
  return career.squad.filter(isPlayerUnavailable);
}

export function canPlayPosition(
  playerId: string,
  position: Position
): boolean {
  const player = getPlayerById(playerId);
  if (!player) return false;
  return getPlayerEligiblePositions(player).includes(position);
}

export function validateMatchdaySquad(
  xiiiIds: string[],
  interchangeIds: string[],
  slotPositions: Position[],
  career?: ManagerCareer
): { valid: boolean; error?: string } {
  if (xiiiIds.length !== ERA_XIII_FROM_STARTING_17) {
    return { valid: false, error: `Need ${ERA_XIII_FROM_STARTING_17} starters` };
  }
  if (interchangeIds.length !== ERA_BENCH_FROM_STARTING_17) {
    return {
      valid: false,
      error: `Need ${ERA_BENCH_FROM_STARTING_17} interchange players`,
    };
  }
  if (slotPositions.length !== ERA_XIII_FROM_STARTING_17) {
    return { valid: false, error: "Position mapping incomplete" };
  }

  const allIds = [...xiiiIds, ...interchangeIds];
  if (new Set(allIds).size !== ERA_STARTING_17_SIZE) {
    return { valid: false, error: "Duplicate players in matchday squad" };
  }

  for (let i = 0; i < xiiiIds.length; i++) {
    const id = xiiiIds[i]!;
    const pos = slotPositions[i]!;
    const eligible = career
      ? getManagerPlayerEligiblePositions(career, id).includes(pos)
      : canPlayPosition(id, pos);
    if (!eligible) {
      const player = career ? getManagerPlayer(career, id) : getPlayerById(id);
      return {
        valid: false,
        error: `${player?.name ?? "Player"} cannot play ${POSITION_SHORT[pos]}`,
      };
    }
  }

  const required: Partial<Record<Position, number>> = {};
  for (const { position, count } of SQUAD_STRUCTURE) {
    required[position] = count;
  }
  const counts: Partial<Record<Position, number>> = {};
  for (const pos of slotPositions) {
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  for (const [pos, need] of Object.entries(required)) {
    if ((counts[pos as Position] ?? 0) !== need) {
      return { valid: false, error: "Invalid formation — check positions" };
    }
  }

  return { valid: true };
}

export function buildSquadSlotsFromMatchday(
  xiiiIds: string[],
  slotPositions: Position[],
  career?: ManagerCareer
): SquadSlot[] {
  return toMatchdaySquadSlots({ xiiiIds, slotPositions, career });
}

export { getManagerFitnessRatingPenalty } from "./matchday-lineup";

/** @deprecated Use getMatchdayTryWeight(position, true) — kept for imports that expect a scalar. */
export const MATCHDAY_INTERCHANGE_TRY_WEIGHT = 0.35;

export interface MatchdayScoringEntry {
  player: NonNullable<SquadSlot["player"]>;
  playedPosition: Position;
  tryWeightMultiplier: number;
}

/** Starting XIII plus interchange for tactic-weighted try allocation. */
export function buildMatchdayScoringEntries(
  career: ManagerCareer,
  xiiiIds: string[] = career.matchdayXiii,
  slotPositions: Position[] = career.xiiiSlotPositions,
  interchangeIds: string[] = career.matchdayInterchange
): MatchdayScoringEntry[] {
  const entries: MatchdayScoringEntry[] = [];

  for (let i = 0; i < xiiiIds.length; i++) {
    const id = xiiiIds[i];
    const pos = slotPositions[i];
    if (!id || !pos) continue;
    const player = getManagerPlayer(career, id);
    if (!player) continue;
    entries.push({
      player,
      playedPosition: pos,
      tryWeightMultiplier: getMatchdayTryWeight(pos, false),
    });
  }

  for (const id of interchangeIds) {
    if (!id) continue;
    const player = getManagerPlayer(career, id);
    if (!player) continue;
    const positions = getManagerPlayerEligiblePositions(career, id);
    const pos = positions[0] ?? player.position;
    entries.push({
      player,
      playedPosition: pos,
      tryWeightMultiplier: getMatchdayTryWeight(pos, true),
    });
  }

  return entries;
}

export function groupPlayersByPosition(
  squad: ManagerPlayerState[]
): Record<Position, ManagerPlayerState[]> {
  const groups = {} as Record<Position, ManagerPlayerState[]>;
  for (const { position } of SQUAD_STRUCTURE) {
    if (!groups[position]) groups[position] = [];
  }
  for (const ps of squad) {
    const player = getPlayerById(ps.playerId);
    if (!player) continue;
    const positions = getPlayerEligiblePositions(player);
    const primary = positions[0] ?? player.position;
    if (!groups[primary]) groups[primary] = [];
    groups[primary].push(ps);
  }
  return groups;
}

export function tickInjuries(squad: ManagerPlayerState[]): ManagerPlayerState[] {
  return squad.map((p) => {
    if (!p.injury || p.injury.matchesRemaining <= 0) {
      return { ...p, injury: null };
    }
    const remaining = p.injury.matchesRemaining - 1;
    if (remaining <= 0) {
      return { ...p, injury: null, fitness: Math.min(100, p.fitness + 15) };
    }
    return {
      ...p,
      injury: { ...p.injury, matchesRemaining: remaining },
    };
  });
}

export function restPlayer(
  squad: ManagerPlayerState[],
  playerId: string
): ManagerPlayerState[] {
  return squad.map((p) =>
    p.playerId === playerId
      ? { ...p, fitness: Math.min(100, p.fitness + 12) }
      : p
  );
}
