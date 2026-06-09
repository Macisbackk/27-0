import seedrandom from "seedrandom";
import {
  CURRENT_PLAYERS,
  HISTORIC_PLAYERS,
  LEGEND_PLAYERS,
  getPlayerById,
} from "../players";
import type { Player, Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";

const MIN_OFFERS = 40;
const MAX_OFFERS = 80;
const CURRENT_RATIO = 0.8;
const LEGEND_WITHIN_HISTORIC = 0.35;

/**
 * Generate a weighted random player sequence.
 * 80% current players, 20% historic (including rare legend reveals).
 */
export function generatePlayerSequence(seed: string): string[] {
  const rng = seedrandom(seed);
  const sequence: string[] = [];
  const usedIds = new Set<string>();

  const positionNeeds: Record<Position, number> = {} as Record<Position, number>;
  for (const { position, count } of SQUAD_STRUCTURE) {
    positionNeeds[position] = count;
  }

  const totalNeeded = Object.values(positionNeeds).reduce((a, b) => a + b, 0);
  const targetOffers =
    Math.floor(rng() * (MAX_OFFERS - MIN_OFFERS + 1)) + MIN_OFFERS;

  const positionCoverage: Record<Position, number> = {} as Record<
    Position,
    number
  >;
  for (const pos of Object.keys(positionNeeds) as Position[]) {
    positionCoverage[pos] = 0;
  }

  for (let i = 0; i < targetOffers; i++) {
    const filledTotal = Object.values(positionCoverage).reduce(
      (a, b) => a + b,
      0
    );
    const progress = filledTotal / totalNeeded;

    let player: Player | null = null;

    if (progress < 0.7 || rng() < 0.6) {
      const needyPositions = (Object.keys(positionNeeds) as Position[]).filter(
        (pos) => positionCoverage[pos] < positionNeeds[pos] * 2
      );

      if (needyPositions.length > 0) {
        const targetPos =
          needyPositions[Math.floor(rng() * needyPositions.length)];
        player = pickPlayerForPosition(targetPos, rng, usedIds);
      }
    }

    if (!player) {
      player = pickAnyPlayer(rng, usedIds);
    }

    if (player) {
      sequence.push(player.id);
      usedIds.add(player.id);
      positionCoverage[player.position]++;
    }
  }

  return sequence;
}

function pickPlayerForPosition(
  position: Position,
  rng: () => number,
  usedIds: Set<string>
): Player | null {
  const pool = selectCategoryPool(rng);
  const candidates = pool.filter(
    (p) => p.position === position && !usedIds.has(p.id)
  );
  if (candidates.length === 0) {
    const fallback = [...CURRENT_PLAYERS, ...HISTORIC_PLAYERS, ...LEGEND_PLAYERS].filter(
      (p) => p.position === position && !usedIds.has(p.id)
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(rng() * fallback.length)];
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

function pickAnyPlayer(rng: () => number, usedIds: Set<string>): Player | null {
  const pool = selectCategoryPool(rng);
  const available = pool.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) {
    const allAvailable = [
      ...CURRENT_PLAYERS,
      ...HISTORIC_PLAYERS,
      ...LEGEND_PLAYERS,
    ].filter((p) => !usedIds.has(p.id));
    if (allAvailable.length === 0) return null;
    return allAvailable[Math.floor(rng() * allAvailable.length)];
  }
  return available[Math.floor(rng() * available.length)];
}

function selectCategoryPool(rng: () => number): Player[] {
  if (rng() < CURRENT_RATIO) {
    return CURRENT_PLAYERS;
  }

  if (rng() < LEGEND_WITHIN_HISTORIC && LEGEND_PLAYERS.length > 0) {
    return LEGEND_PLAYERS;
  }

  return HISTORIC_PLAYERS;
}

export function getWeeklyKey(date?: Date): string {
  const d = date ?? new Date();
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getUTCDay() +
      1) /
      7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getMonthlyKey(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function generateRunSeed(): string {
  return `classic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resolve a sequence of IDs to player objects (for validation) */
export function resolveSequence(ids: string[]): Player[] {
  return ids.map((id) => getPlayerById(id)).filter((p): p is Player => !!p);
}
