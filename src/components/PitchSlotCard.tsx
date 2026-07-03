"use client";

import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { formatPitchSlotPlayerName } from "@/lib/players/display-name";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { getEffectivePeakRating } from "@/lib/squad-analysis";

/** Shared footprint for empty and filled pitch slots — scales with pitch width. */
export const PITCH_SLOT_SIZE_CLASS =
  "h-[clamp(54px,13vw,88px)] w-[clamp(50px,12vw,82px)] sm:h-[clamp(60px,13.5vw,96px)] sm:w-[clamp(54px,12.5vw,88px)] md:h-[clamp(68px,14vw,108px)] md:w-[clamp(62px,13vw,100px)]";

export const PITCH_SLOT_COMPACT_CLASS =
  "h-[clamp(42px,9.5vw,64px)] w-[clamp(40px,9vw,60px)]";

/** Season review team sheet — compact two-line names without dead space. */
export const PITCH_SLOT_REVIEW_CLASS =
  "h-[clamp(48px,10.5vw,62px)] w-[clamp(50px,11vw,68px)] sm:h-[clamp(52px,11vw,66px)] sm:w-[clamp(54px,11.5vw,74px)]";

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
  const isReviewSheet = fullPlayerNames;
  const isMatchdayPitch = !compact && !fullPlayerNames;
  const isTeamSheet = compact || fullPlayerNames;
  const positionLabel = slot.label;
  const effectiveRating = getEffectivePeakRating(slot);
  const ratingLabel = hardMode ? "??" : String(Math.round(effectiveRating));
  const sizeClass = fullPlayerNames
    ? PITCH_SLOT_REVIEW_CLASS
    : compact
      ? PITCH_SLOT_COMPACT_CLASS
      : PITCH_SLOT_SIZE_CLASS;
  const fullName = formatPitchSlotPlayerName(player.name, false);
  const compactName = formatPitchSlotPlayerName(player.name, true);
  const displayName = fullPlayerNames
    ? player.name
    : formatPitchSlotPlayerName(player.name, compact);

  return (
    <div
      className={`pitch-slot-card flex shrink-0 flex-col rounded-lg border-2 border-accent-green/50 bg-black/75 shadow-[0_0_10px_rgba(34,197,94,0.2)] ${sizeClass} overflow-hidden ${className}`}
      title={player.name}
    >
      <div
        className={`flex w-full shrink-0 ${isMatchdayPitch ? "h-1 sm:h-1.5" : "h-1"}`}
      >
        <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
        <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col items-stretch px-1 ${
          isMatchdayPitch
            ? "justify-between gap-0.5 py-0.5 sm:gap-1 sm:px-1.5 sm:py-1 md:px-2 md:py-1.5"
            : isReviewSheet
              ? "justify-between gap-0 py-0.5"
              : "items-center justify-center gap-0 py-0.5"
        }`}
      >
        <span
          className={`w-full shrink-0 text-center font-display font-semibold text-gray-400 ${
            isMatchdayPitch
              ? "text-[8px] leading-none sm:text-[9px] md:text-[10px]"
              : isTeamSheet
                ? "line-clamp-2 px-0.5 text-[5.5px] leading-[1.08] sm:text-[6.5px]"
                : "line-clamp-2 text-[7px] leading-[1.05] sm:text-[8px]"
          }`}
        >
          {positionLabel}
        </span>
        {isMatchdayPitch ? (
          <p className="min-h-0 w-full flex-1 text-center font-display font-semibold leading-snug text-white">
            <span className="line-clamp-2 break-words text-[8px] sm:hidden">
              {compactName}
            </span>
            <span className="line-clamp-2 hidden break-words sm:inline md:text-[11px]">
              {fullName}
            </span>
          </p>
        ) : (
          <p
            className={`min-h-0 w-full text-center font-display font-semibold text-white ${
              fullPlayerNames
                ? "line-clamp-2 shrink-0 break-words [overflow-wrap:anywhere] px-0.5 text-[7px] leading-[1.08] sm:text-[8px]"
                : compact
                  ? "truncate px-0.5 text-[8px] leading-[1.15] sm:text-[9px]"
                  : "line-clamp-2 break-words text-[7px] leading-[1.15] sm:text-[8px]"
            }`}
          >
            {displayName}
          </p>
        )}
        {!hardMode && (
          <span
            className={`w-full shrink-0 text-center font-display font-black leading-none text-accent-green ${
              fullPlayerNames
                ? "text-[11px] sm:text-xs"
                : compact
                  ? "text-[10px] sm:text-[11px]"
                  : "text-sm sm:text-base md:text-xl lg:text-2xl"
            }`}
          >
            {ratingLabel}
          </span>
        )}
      </div>
    </div>
  );
}
