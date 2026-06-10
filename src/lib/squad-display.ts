import type { Position, SquadSlot } from "./types";
import { POSITION_LABELS } from "./positions";
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

export function getSlotDisplayInfo(slot: SquadSlot): SlotDisplayInfo | null {
  if (!slot.player) return null;

  const naturalPosition = slot.player.position;
  const playedPosition = slot.position;
  const positionMismatch = naturalPosition !== playedPosition;
  const originalRating = slot.player.peakRating;
  const adjustedRating = getEffectivePeakRating(slot);
  const ratingAdjusted = adjustedRating !== originalRating;

  const naturalLabel = POSITION_LABELS[naturalPosition];
  const playedLabel = POSITION_LABELS[playedPosition];

  return {
    naturalPosition,
    playedPosition,
    positionMismatch,
    positionCompact: positionMismatch
      ? `${naturalLabel} → ${playedLabel}`
      : null,
    positionBlock: positionMismatch
      ? `Natural: ${naturalLabel}\nPlayed: ${playedLabel}`
      : null,
    originalRating,
    adjustedRating,
    ratingAdjusted,
    ratingCompact: ratingAdjusted
      ? `${originalRating} → ${adjustedRating} OVR`
      : null,
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
    ratingNote:
      reveal && info.ratingAdjusted ? info.ratingCompact : null,
  };
}

export function findSlotByPlayerId(
  squad: SquadSlot[],
  playerId: string
): SquadSlot | undefined {
  return squad.find((s) => s.player?.id === playerId);
}
