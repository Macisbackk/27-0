import type { Position, SquadSlot } from "./types";

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
  PROP: "PR",
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

/**
 * Rugby League team-sheet rows (attacking upward).
 * Grid layout prevents card overlap vs legacy percentage coords.
 */
export const FORMATION_ROWS: number[][] = [
  [0],
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8, 9],
  [10, 11, 12],
];

/** @deprecated Use FORMATION_ROWS grid layout */
export const FORMATION_COORDS: Record<
  number,
  { left: number; top: number }
> = {
  0: { left: 50, top: 14 },
  1: { left: 18, top: 26 },
  2: { left: 82, top: 26 },
  3: { left: 30, top: 38 },
  4: { left: 70, top: 38 },
  5: { left: 30, top: 50 },
  6: { left: 70, top: 50 },
  7: { left: 18, top: 68 },
  8: { left: 50, top: 68 },
  9: { left: 82, top: 68 },
  10: { left: 18, top: 82 },
  11: { left: 50, top: 82 },
  12: { left: 82, top: 82 },
};

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
  slotIndex: number
): SquadSlot[] {
  return squad.map((s) =>
    s.slotIndex === slotIndex ? { ...s, player } : s
  );
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
