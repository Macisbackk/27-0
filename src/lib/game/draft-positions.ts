import type { Position, SquadSlot } from "../types";
import { POSITION_LABELS, POSITION_SHORT, SQUAD_STRUCTURE } from "../positions";

export interface PositionRemainingEntry {
  position: Position;
  label: string;
  total: number;
  filled: number;
  remaining: number;
}

export const HALFBACK_POSITIONS: Position[] = ["STAND_OFF", "SCRUM_HALF"];

/** Draft choice balancing group — Stand Off and Scrum Half share one pool. */
export function getDraftBalanceGroup(position: Position): string {
  if (position === "STAND_OFF" || position === "SCRUM_HALF") return "HALFBACK";
  return position;
}

export function positionsInSameDraftGroup(a: Position, b: Position): boolean {
  return getDraftBalanceGroup(a) === getDraftBalanceGroup(b);
}

export interface DraftGroupRemaining {
  need: number;
  positions: Position[];
}

export function getDraftGroupRemainingCounts(
  squad: SquadSlot[]
): Map<string, DraftGroupRemaining> {
  const remaining = getRemainingPositionCounts(squad);
  const groups = new Map<string, DraftGroupRemaining>();

  for (const [position, count] of remaining) {
    const group = getDraftBalanceGroup(position);
    const existing = groups.get(group);
    if (existing) {
      existing.need += count;
      existing.positions.push(position);
    } else {
      groups.set(group, { need: count, positions: [position] });
    }
  }
  return groups;
}

export interface DraftPositionDisplayEntry {
  key: string;
  label: string;
  remaining: number;
}

const DRAFT_DISPLAY_GROUPS: { key: string; label: string; positions: Position[] }[] =
  [
    { key: "FULLBACK", label: POSITION_SHORT.FULLBACK, positions: ["FULLBACK"] },
    { key: "WING", label: POSITION_SHORT.WING, positions: ["WING"] },
    { key: "CENTRE", label: POSITION_SHORT.CENTRE, positions: ["CENTRE"] },
    {
      key: "HALFBACK",
      label: "HB",
      positions: HALFBACK_POSITIONS,
    },
    { key: "PROP", label: POSITION_SHORT.PROP, positions: ["PROP"] },
    { key: "HOOKER", label: POSITION_SHORT.HOOKER, positions: ["HOOKER"] },
    {
      key: "SECOND_ROW",
      label: POSITION_SHORT.SECOND_ROW,
      positions: ["SECOND_ROW"],
    },
    {
      key: "LOOSE_FORWARD",
      label: POSITION_SHORT.LOOSE_FORWARD,
      positions: ["LOOSE_FORWARD"],
    },
  ];

/** Compact UI chips — combines halfbacks; only unfilled slots. */
export function getDraftPositionRemainingDisplay(
  squad: SquadSlot[]
): DraftPositionDisplayEntry[] {
  const entries = getPositionRemainingEntries(squad);
  const byPosition = new Map(entries.map((entry) => [entry.position, entry]));

  return DRAFT_DISPLAY_GROUPS.flatMap((group) => {
    const remaining = group.positions.reduce(
      (sum, position) => sum + (byPosition.get(position)?.remaining ?? 0),
      0
    );
    if (remaining <= 0) return [];
    return [{ key: group.key, label: group.label, remaining }];
  });
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
  return getDraftPositionRemainingDisplay(squad)
    .map((entry) =>
      entry.remaining > 1
        ? `${entry.label} x${entry.remaining}`
        : entry.label
    )
    .join(", ");
}

export function formatPositionsRemainingLines(squad: SquadSlot[]): string[] {
  return getDraftPositionRemainingDisplay(squad).map((entry) =>
    entry.remaining > 1 ? `${entry.label} x${entry.remaining}` : entry.label
  );
}
