import type { Position, SquadSlot } from "./types";
import {
  isPenaltyFreePlacement,
  OUT_OF_POSITION_PENALTY,
} from "./players/player-positions";

export const POSITION_LABELS: Record<Position, string> = {
  FULLBACK: "Fullback",
  WING: "Wing",
  CENTRE: "Centre",
  STAND_OFF: "Stand Off",
  SCRUM_HALF: "Scrum Half",
  PROP: "Prop",
  HOOKER: "Hooker",
  SECOND_ROW: "Second Row",
  LOOSE_FORWARD: "Loose Forward",
};

/** Full uppercase position names for pitch cards and selection tiles. */
export const POSITION_TILE_LABEL: Record<Position, string> = {
  FULLBACK: "FULL BACK",
  WING: "WINGER",
  CENTRE: "CENTRE",
  STAND_OFF: "STAND OFF",
  SCRUM_HALF: "SCRUM HALF",
  PROP: "PROP",
  HOOKER: "HOOKER",
  SECOND_ROW: "SECOND ROW",
  LOOSE_FORWARD: "LOOSE FORWARD",
};

export const POSITION_SHORT: Record<Position, string> = {
  FULLBACK: "FB",
  WING: "WG",
  CENTRE: "CE",
  STAND_OFF: "SO",
  SCRUM_HALF: "SH",
  PROP: "PF",
  HOOKER: "HK",
  SECOND_ROW: "SR",
  LOOSE_FORWARD: "LF",
};

export const POSITION_DESCRIPTIONS: Record<Position, string> = {
  FULLBACK: "Last line of defence.",
  WING: "Finishes tries out wide.",
  CENTRE: "Creates breaks in the midfield.",
  STAND_OFF: "Directs attacking play.",
  SCRUM_HALF: "Primary playmaker.",
  PROP: "Anchors the forward pack.",
  HOOKER: "Controls the middle of the field.",
  SECOND_ROW: "Power and mobility in the pack.",
  LOOSE_FORWARD: "Links forwards and backs.",
};

/** Rugby League formation — slot order matches team sheet layout */
const SLOT_DEFINITIONS: { position: Position; label: string }[] = [
  { position: "FULLBACK", label: "Fullback" },
  { position: "WING", label: "Left Wing" },
  { position: "WING", label: "Right Wing" },
  { position: "CENTRE", label: "Left Centre" },
  { position: "CENTRE", label: "Right Centre" },
  { position: "STAND_OFF", label: "Stand Off" },
  { position: "SCRUM_HALF", label: "Scrum Half" },
  { position: "PROP", label: "Left Prop" },
  { position: "HOOKER", label: "Hooker" },
  { position: "PROP", label: "Right Prop" },
  { position: "SECOND_ROW", label: "Left Second Row" },
  { position: "LOOSE_FORWARD", label: "Loose Forward" },
  { position: "SECOND_ROW", label: "Right Second Row" },
];

/** All 13 starting slots in team-sheet order. */
export const FORMATION_SLOT_INDICES = [
  0, 1, 3, 4, 2, 5, 6, 7, 8, 9, 10, 12, 11,
] as const;

/** Fixed recruitment order for Normal Mode slot spins (matches formation sheet). */
export const RECRUIT_SLOT_ORDER = FORMATION_SLOT_INDICES;

/** Next slot index to fill during Normal Mode recruitment (by filled count). */
export function getNextRecruitSlotIndex(filledCount: number): number | null {
  if (filledCount >= TOTAL_SLOTS) return null;
  return RECRUIT_SLOT_ORDER[filledCount] ?? null;
}

/** Display label for a formation slot (matches team sheet / player selection). */
export function getFormationSlotDisplayLabel(slotIndex: number): string {
  const def = SLOT_DEFINITIONS[slotIndex];
  if (!def) return "Unknown";
  if (def.position === "FULLBACK") return "Full Back";
  return POSITION_LABELS[def.position];
}

/** Sort key for rendering players in team-sheet order. */
export function getFormationSlotSortOrder(slotIndex: number): number {
  const order = FORMATION_SLOT_INDICES.indexOf(
    slotIndex as (typeof FORMATION_SLOT_INDICES)[number]
  );
  return order >= 0 ? order : slotIndex + 100;
}

/**
 * Rugby League 13-player formation — percentage coords inside pitch container.
 * FB → back line (LW, LC, RC, RW) → halves → front row → second row → loose forward.
 */
export const FORMATION_COORDS: Record<
  number,
  { left: number; top: number }
> = {
  0: { left: 50, top: 8 },
  1: { left: 14, top: 24 },
  3: { left: 34, top: 24 },
  4: { left: 66, top: 24 },
  2: { left: 86, top: 24 },
  5: { left: 36, top: 40 },
  6: { left: 64, top: 40 },
  7: { left: 26, top: 58 },
  8: { left: 50, top: 58 },
  9: { left: 74, top: 58 },
  10: { left: 34, top: 76 },
  12: { left: 66, top: 76 },
  11: { left: 50, top: 90 },
};

/** Standard RL shirt numbers 1–13 for pitch slot indices. */
export const FORMATION_SLOT_NUMBER: Record<number, number> = {
  0: 1,
  1: 2,
  3: 3,
  4: 4,
  2: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 11,
  12: 12,
  11: 13,
};

/** @deprecated Use FORMATION_COORDS absolute layout */
export const FORMATION_ROWS: number[][] = [
  [0],
  [1, 3, 4, 2],
  [5, 6],
  [7, 8, 9],
  [10, 12],
  [11],
];

/** 13-player Super League starting side structure */
export const SQUAD_STRUCTURE: { position: Position; count: number }[] = [
  { position: "FULLBACK", count: 1 },
  { position: "WING", count: 2 },
  { position: "CENTRE", count: 2 },
  { position: "STAND_OFF", count: 1 },
  { position: "SCRUM_HALF", count: 1 },
  { position: "PROP", count: 2 },
  { position: "HOOKER", count: 1 },
  { position: "SECOND_ROW", count: 2 },
  { position: "LOOSE_FORWARD", count: 1 },
];

export const TOTAL_SLOTS = SQUAD_STRUCTURE.reduce((sum, s) => sum + s.count, 0);

/** Slot index for the loose forward in the team sheet formation. */
export const LOOSE_FORWARD_SLOT_INDEX = 11;

export function createEmptySquad(): SquadSlot[] {
  return SLOT_DEFINITIONS.map((def, slotIndex) => ({
    position: def.position,
    slotIndex,
    label: def.label,
    player: null,
  }));
}

export function getEmptySlots(squad: SquadSlot[]): SquadSlot[] {
  return squad.filter((s) => s.player === null);
}

export function findOpenSlot(
  squad: SquadSlot[],
  position: Position
): SquadSlot | undefined {
  return squad.find((s) => s.position === position && s.player === null);
}

export function canSignPlayer(squad: SquadSlot[], position: Position): boolean {
  return !!findOpenSlot(squad, position);
}

export function signPlayerToSquad(
  squad: SquadSlot[],
  player: import("./types").Player
): SquadSlot[] {
  const slot = findOpenSlot(squad, player.position);
  if (!slot) return squad;
  return signPlayerToSlot(squad, player, slot.slotIndex);
}

export function signPlayerToSlot(
  squad: SquadSlot[],
  player: import("./types").Player,
  slotIndex: number,
  runRatingPenalty = 0
): SquadSlot[] {
  return squad.map((s) => {
    if (s.slotIndex !== slotIndex) return s;
    const penalty = isPenaltyFreePlacement(player, s.position)
      ? undefined
      : runRatingPenalty || OUT_OF_POSITION_PENALTY;
    return { ...s, player, runRatingPenalty: penalty };
  });
}

export function getSquadValue(squad: SquadSlot[]): number {
  return squad.reduce((sum, s) => sum + (s.player?.value ?? 0), 0);
}

export function getFilledCount(squad: SquadSlot[]): number {
  return squad.filter((s) => s.player !== null).length;
}

export function isSquadComplete(squad: SquadSlot[]): boolean {
  return getFilledCount(squad) === TOTAL_SLOTS;
}
