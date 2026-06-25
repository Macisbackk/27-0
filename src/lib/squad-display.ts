import type { Position, SquadSlot } from "./types";
import { POSITION_LABELS } from "./positions";
import { isPenaltyFreePlacement } from "./players/player-positions";
import {
  getEffectivePeakRating,
  type ClubPlayerEntry,
} from "./squad-analysis";

export interface SlotDisplayInfo {
  naturalPosition: Position;
  playedPosition: Position;
  positionMismatch: boolean;
  positionCompact: string | null;
  positionBlock: string | null;
  originalRating: number;
  adjustedRating: number;
  ratingAdjusted: boolean;
  ratingCompact: string | null;
  ratingBlock: string | null;
}

function formatPositionArrow(
  naturalPosition: Position,
  playedPosition: Position
): string {
  return `${POSITION_LABELS[naturalPosition]} → ${POSITION_LABELS[playedPosition]}`;
}

export function formatPositionReviewText(
  info: Pick<
    SlotDisplayInfo,
    "positionMismatch" | "naturalPosition" | "playedPosition"
  >
): string {
  if (info.positionMismatch) {
    return formatPositionArrow(info.naturalPosition, info.playedPosition);
  }
  return POSITION_LABELS[info.playedPosition];
}

export function getSlotDisplayInfo(slot: SquadSlot): SlotDisplayInfo | null {
  if (!slot.player) return null;

  const naturalPosition = slot.player.position;
  const playedPosition = slot.position;
  const positionMismatch = !isPenaltyFreePlacement(slot.player, playedPosition);
  const originalRating = slot.player.peakRating;
  const adjustedRating = isPenaltyFreePlacement(slot.player, playedPosition)
    ? originalRating
    : getEffectivePeakRating(slot);
  const ratingAdjusted = adjustedRating !== originalRating;

  return {
    naturalPosition,
    playedPosition,
    positionMismatch,
    positionCompact: positionMismatch
      ? formatPositionArrow(naturalPosition, playedPosition)
      : null,
    positionBlock: positionMismatch
      ? formatPositionArrow(naturalPosition, playedPosition)
      : null,
    originalRating,
    adjustedRating,
    ratingAdjusted,
    ratingCompact: ratingAdjusted
      ? `${originalRating} → ${adjustedRating} OVR`
      : `${adjustedRating} OVR`,
    ratingBlock: ratingAdjusted
      ? `Original Rating: ${originalRating}\nAdjusted Rating: ${adjustedRating}`
      : null,
  };
}

export function formatPlayerLineExtras(
  slot: SquadSlot | undefined,
  options?: { revealRatings?: boolean }
): { positionNote: string | null; ratingNote: string | null } {
  if (!slot) return { positionNote: null, ratingNote: null };
  const info = getSlotDisplayInfo(slot);
  if (!info) return { positionNote: null, ratingNote: null };

  const reveal = options?.revealRatings !== false;

  return {
    positionNote: info.positionCompact,
    ratingNote: reveal ? info.ratingCompact : null,
  };
}

export function findSlotByPlayerId(
  squad: SquadSlot[],
  playerId: string
): SquadSlot | undefined {
  return squad.find((s) => s.player?.id === playerId);
}
