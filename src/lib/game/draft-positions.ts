import type { Position, SquadSlot } from "../types";
import { POSITION_LABELS, SQUAD_STRUCTURE } from "../positions";

export interface PositionRemainingEntry {
  position: Position;
  label: string;
  total: number;
  filled: number;
  remaining: number;
}

export function getPositionRemainingEntries(
  squad: SquadSlot[]
): PositionRemainingEntry[] {
  return SQUAD_STRUCTURE.map(({ position, count }) => {
    const filled = squad.filter(
      (slot) => slot.position === position && slot.player
    ).length;
    return {
      position,
      label: POSITION_LABELS[position],
      total: count,
      filled,
      remaining: Math.max(0, count - filled),
    };
  });
}

export function getRemainingPositionCounts(
  squad: SquadSlot[]
): Map<Position, number> {
  const counts = new Map<Position, number>();
  for (const entry of getPositionRemainingEntries(squad)) {
    if (entry.remaining > 0) {
      counts.set(entry.position, entry.remaining);
    }
  }
  return counts;
}

export function formatPositionsRemainingSummary(squad: SquadSlot[]): string {
  return getPositionRemainingEntries(squad)
    .filter((entry) => entry.remaining > 0)
    .map((entry) =>
      entry.remaining > 1
        ? `${entry.label} x${entry.remaining}`
        : entry.label
    )
    .join(", ");
}

export function formatPositionsRemainingLines(squad: SquadSlot[]): string[] {
  return getPositionRemainingEntries(squad).map((entry) => {
    if (entry.remaining === 0) {
      return `${entry.label} ✓`;
    }
    if (entry.remaining > 1) {
      return `${entry.label} x${entry.remaining}`;
    }
    return entry.label;
  });
}
