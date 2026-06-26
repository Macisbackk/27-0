"use client";

import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { formatPitchSlotPlayerName } from "@/lib/players/display-name";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { POSITION_SHORT } from "@/lib/positions";
import { getEffectivePeakRating } from "@/lib/squad-analysis";

/** Shared footprint for empty and filled pitch slots — scales down on mobile. */
export const PITCH_SLOT_SIZE_CLASS =
  "h-[clamp(46px,10.5vw,76px)] w-[clamp(42px,9.5vw,70px)]";

export const PITCH_SLOT_COMPACT_CLASS =
  "h-[clamp(40px,9vw,60px)] w-[clamp(38px,8.5vw,56px)]";

/** Season review team sheet — room for two-line full names on mobile. */
export const PITCH_SLOT_REVIEW_CLASS =
  "h-[clamp(54px,12vw,70px)] w-[clamp(40px,9vw,58px)]";

interface PitchSlotCardProps {
  slot: SquadSlot;
  hardMode?: boolean;
  clubColorOverride?: string;
  className?: string;
  compact?: boolean;
  /** Show full player name (season review / team sheet). */
  fullPlayerNames?: boolean;
}

/** Compact tactical-board marker — matches empty position box footprint. */
export function PitchSlotCard({
  slot,
  hardMode,
  clubColorOverride,
  className = "",
  compact = false,
  fullPlayerNames = false,
}: PitchSlotCardProps) {
  const player = slot.player!;
  const colors = getClubColors(getPlayerColorClub(player, clubColorOverride));
  const positionLabel = POSITION_SHORT[slot.position];
  const effectiveRating = getEffectivePeakRating(slot);
  const ratingLabel = hardMode ? "??" : String(Math.round(effectiveRating));
  const sizeClass = fullPlayerNames
    ? PITCH_SLOT_REVIEW_CLASS
    : compact
      ? PITCH_SLOT_COMPACT_CLASS
      : PITCH_SLOT_SIZE_CLASS;
  const displayName = fullPlayerNames
    ? player.name
    : formatPitchSlotPlayerName(player.name, compact);

  return (
    <div
      className={`pitch-slot-card flex shrink-0 flex-col rounded-lg border-2 border-accent-green/50 bg-black/70 shadow-[0_0_10px_rgba(34,197,94,0.2)] ${sizeClass} overflow-hidden ${className}`}
      title={player.name}
    >
      <div className="flex h-1 w-full shrink-0">
        <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
        <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0 px-0.5 py-0.5">
        <span className="shrink-0 font-display text-[7px] font-bold uppercase leading-none tracking-wide text-gray-400 sm:text-[8px]">
          {positionLabel}
        </span>
        <p
          className={`min-h-0 w-full flex-1 text-center font-display font-semibold leading-[1.15] text-white ${
            fullPlayerNames
              ? "line-clamp-2 break-words [overflow-wrap:anywhere] px-0.5 text-[7px] sm:text-[8px]"
              : compact
                ? "truncate px-0.5 text-[8px] sm:text-[9px]"
                : "line-clamp-2 break-words text-[7px] sm:text-[8px]"
          }`}
        >
          {displayName}
        </p>
        {!hardMode && (
          <span
            className={`shrink-0 font-display font-black leading-none ${
              compact || fullPlayerNames
                ? "text-[9px] sm:text-[10px]"
                : "text-[10px] sm:text-xs"
            } text-accent-green`}
          >
            {ratingLabel}
          </span>
        )}
      </div>
    </div>
  );
}
