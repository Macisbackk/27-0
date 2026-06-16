"use client";

import type { Player } from "@/lib/types";
import {
  formatPlayerDisplayName,
  formatValue,
} from "@/lib/players";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";
import { getPlayerAge } from "@/lib/players/player-age";
import {
  PlayerStatusBadge,
  resolvePlayerStatus,
  type PlayerStatusType,
} from "./cards/PlayerStatusBadge";

interface SlotRecruitPlayerCardProps {
  player: Player;
  hardMode?: boolean;
  /** Era / slot team accent colour */
  clubColorOverride?: string;
}

function statusAccentColor(
  status: PlayerStatusType | null,
  teamPrimary: string
): string {
  if (status === "historic") return "#a855f7";
  if (status === "legend") return "#fbbf24";
  if (status === "current") return "#22c55e";
  return teamPrimary;
}

export function SlotRecruitPlayerCard({
  player,
  hardMode,
  clubColorOverride,
}: SlotRecruitPlayerCardProps) {
  const colorClub = clubColorOverride ?? getPlayerColorClub(player);
  const colors = getClubColors(colorClub);
  const status = resolvePlayerStatus(player);
  const age = getPlayerAge(player);
  const ageLabel = age !== undefined ? String(age) : null;
  const displayName = formatPlayerDisplayName(player);
  const positionLabel = POSITION_LABELS[player.position];
  const ratingText = hardMode ? "???" : String(player.peakRating);
  const valueText = hardMode ? "???" : formatValue(player.value);
  const accent = statusAccentColor(status, colors.primary);

  return (
    <div
      className={`relative flex h-full min-h-[5.25rem] flex-col overflow-hidden rounded-lg border bg-pitch-900/75 px-2 py-1.5 sm:min-h-[5.75rem] sm:px-2.5 sm:py-2 ${
        status === "historic"
          ? "border-purple-500/35"
          : status === "legend"
            ? "border-amber-400/35"
            : status === "current"
              ? "border-emerald-500/25"
              : "border-pitch-600/50"
      }`}
      style={{
        boxShadow: `inset 3px 0 0 ${accent}88`,
      }}
    >
      <p className="line-clamp-2 font-display text-[11px] font-bold leading-tight text-white sm:text-xs">
        {displayName}
      </p>

      <p className="mt-0.5 line-clamp-1 text-[9px] text-gray-400 sm:text-[10px]">
        {positionLabel}
        {ageLabel !== null && (
          <>
            <span aria-hidden className="px-0.5">
              ·
            </span>
            {ageLabel}
          </>
        )}
      </p>

      <div className="mt-auto flex min-w-0 items-end justify-between gap-1 pt-1">
        <p className="min-w-0 truncate text-[9px] font-semibold text-accent-green sm:text-[10px]">
          <span className="font-display font-black">{ratingText}</span>
          {!hardMode && (
            <>
              <span className="px-0.5 font-normal text-gray-500">·</span>
              <span className="text-gray-300">{valueText}</span>
            </>
          )}
        </p>
        {status && (
          <PlayerStatusBadge
            status={status}
            compact
            className="!mt-0 shrink-0 scale-[0.85] origin-bottom-right sm:scale-90"
          />
        )}
      </div>
    </div>
  );
}
