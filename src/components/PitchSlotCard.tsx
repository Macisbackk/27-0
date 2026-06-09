"use client";

import type { Player } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerInitials } from "@/lib/players/initials";
import { POSITION_SHORT, POSITION_TILE_LABEL } from "@/lib/positions";

/** Shared footprint for empty and filled pitch slots. */
export const PITCH_SLOT_SIZE_CLASS =
  "h-[68px] w-[60px] sm:h-[72px] sm:w-[64px]";

interface PitchSlotCardProps {
  player: Player;
  hardMode?: boolean;
  className?: string;
}

/** Compact tactical-board marker — matches empty position box footprint. */
export function PitchSlotCard({
  player,
  hardMode,
  className = "",
}: PitchSlotCardProps) {
  const colors = getClubColors(player.club);
  const initials = getPlayerInitials(player.name);
  const positionLabel = POSITION_TILE_LABEL[player.position];
  const shortPos = POSITION_SHORT[player.position];

  return (
    <div
      className={`pitch-slot-card flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/35 bg-black/55 shadow-sm ${PITCH_SLOT_SIZE_CLASS} ${className}`}
      title={player.name}
    >
      <div className="flex h-1 w-full shrink-0">
        <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
        <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0 px-0.5 py-0.5">
        <span className="font-display text-[9px] font-black uppercase leading-none tracking-wide text-accent-green sm:text-[10px]">
          {initials}
        </span>
        <span className="w-full text-center font-display text-[6px] font-bold uppercase leading-tight tracking-wide text-gray-300 sm:text-[7px]">
          {positionLabel}
        </span>
        <span className="font-display text-[5px] font-bold tracking-wider text-gray-500 sm:text-[6px]">
          {shortPos}
        </span>
        <p className="w-full truncate text-center font-display text-[6px] font-semibold leading-tight text-white sm:text-[7px]">
          {player.name}
        </p>
        {!hardMode && (
          <span className="font-display text-[7px] font-bold leading-none text-accent-green/90 sm:text-[8px]">
            {player.peakRating}
          </span>
        )}
      </div>
    </div>
  );
}
