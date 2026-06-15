"use client";

import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { POSITION_TILE_LABEL } from "@/lib/positions";
import { getEffectivePeakRating } from "@/lib/squad-analysis";

/** Shared footprint for empty and filled pitch slots — scales down on mobile. */
export const PITCH_SLOT_SIZE_CLASS =
  "h-[clamp(60px,14vw,96px)] w-[clamp(54px,12vw,88px)]";

interface PitchSlotCardProps {
  slot: SquadSlot;
  hardMode?: boolean;
  /** Era mode: use era team club colours instead of the player's current club. */
  clubColorOverride?: string;
  className?: string;
}

/** Compact tactical-board marker — matches empty position box footprint. */
export function PitchSlotCard({
  slot,
  hardMode,
  clubColorOverride,
  className = "",
}: PitchSlotCardProps) {
  const player = slot.player!;
  const colors = getClubColors(getPlayerColorClub(player, clubColorOverride));
  const positionLabel = POSITION_TILE_LABEL[slot.position];
  const effectiveRating = getEffectivePeakRating(slot);
  const baseRating = player.peakRating;
  const hasPenalty =
    (slot.runRatingPenalty ?? 0) > 0 && effectiveRating < baseRating;
  const ratingLabel = hardMode ? "??" : String(Math.round(effectiveRating));

  return (
    <div
      className={`pitch-slot-card flex shrink-0 flex-col overflow-hidden rounded-lg border-2 border-accent-green/50 bg-black/70 shadow-[0_0_10px_rgba(34,197,94,0.2)] ${PITCH_SLOT_SIZE_CLASS} ${className}`}
      title={player.name}
    >
      <div className="flex h-1 w-full shrink-0">
        <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
        <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0 px-0.5 py-0.5">
        <span
          className={`font-display text-sm font-black leading-none sm:text-base ${
            hardMode ? "text-gray-500" : "text-accent-green"
          }`}
        >
          {ratingLabel}
        </span>
        {!hardMode && hasPenalty && (
          <span className="font-display text-[6px] font-bold leading-none text-gray-500 sm:text-[7px]">
            {baseRating}→{Math.round(effectiveRating)}
          </span>
        )}
        <span className="w-full text-center font-display text-[8px] font-bold uppercase leading-tight tracking-wide text-gray-300 sm:text-[9px]">
          {positionLabel}
        </span>
        <p className="w-full truncate text-center font-display text-[7px] font-semibold leading-tight text-white sm:text-[8px]">
          {player.name}
        </p>
      </div>
    </div>
  );
}
