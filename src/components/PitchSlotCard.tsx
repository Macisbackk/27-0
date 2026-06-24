"use client";

import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { POSITION_SHORT } from "@/lib/positions";
import { getEffectivePeakRating } from "@/lib/squad-analysis";

/** Shared footprint for empty and filled pitch slots — scales down on mobile. */
export const PITCH_SLOT_SIZE_CLASS =
  "h-[clamp(46px,10.5vw,76px)] w-[clamp(42px,9.5vw,70px)]";

export const PITCH_SLOT_COMPACT_CLASS =
  "h-[clamp(38px,8.5vw,58px)] w-[clamp(34px,7.5vw,54px)]";

interface PitchSlotCardProps {
  slot: SquadSlot;
  hardMode?: boolean;
  clubColorOverride?: string;
  className?: string;
  compact?: boolean;
}

/** Compact tactical-board marker — matches empty position box footprint. */
export function PitchSlotCard({
  slot,
  hardMode,
  clubColorOverride,
  className = "",
  compact = false,
}: PitchSlotCardProps) {
  const player = slot.player!;
  const colors = getClubColors(getPlayerColorClub(player, clubColorOverride));
  const positionLabel = POSITION_SHORT[slot.position];
  const effectiveRating = getEffectivePeakRating(slot);
  const ratingLabel = hardMode ? "??" : String(Math.round(effectiveRating));

  return (
    <div
      className={`pitch-slot-card flex shrink-0 flex-col rounded-lg border-2 border-accent-green/50 bg-black/70 shadow-[0_0_10px_rgba(34,197,94,0.2)] ${
        compact ? `${PITCH_SLOT_COMPACT_CLASS} overflow-visible` : `${PITCH_SLOT_SIZE_CLASS} overflow-hidden`
      } ${className}`}
      title={player.name}
    >
      <div className="flex h-1 w-full shrink-0">
        <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
        <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0 px-0.5 py-0.5">
        <span className="font-display text-[7px] font-bold uppercase leading-none tracking-wide text-gray-400 sm:text-[8px]">
          {positionLabel}
        </span>
        {!hardMode && (
          <span
            className={`font-display font-black leading-none ${
              compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"
            } text-accent-green`}
          >
            {ratingLabel}
          </span>
        )}
        <p className="line-clamp-2 w-full break-words text-center font-display text-[7px] font-semibold leading-tight text-white sm:text-[8px]">
          {player.name}
        </p>
      </div>
    </div>
  );
}
