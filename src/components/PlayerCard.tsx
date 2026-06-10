"use client";

import type { Player } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";
import { ClubLogoBox } from "./ClubBadge";
import { RLTag } from "./cards/rl-card";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";

interface PlayerCardProps {
  player: Player;
  canSign?: boolean;
  compact?: boolean;
  selectable?: boolean;
  hardMode?: boolean;
  equalHeight?: boolean;
  compactMobile?: boolean;
}

export function PlayerCard({
  player,
  canSign,
  compact,
  selectable,
  hardMode,
  equalHeight,
  compactMobile,
}: PlayerCardProps) {
  const colors = getClubColors(player.club);

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-pitch-600/40 bg-pitch-800/40 px-2.5 py-1.5">
        <ClubLogoBox club={player.club} colors={colors} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{player.name}</p>
          <p className="text-xs text-gray-500">
            {POSITION_LABELS[player.position]}
            {!hardMode && ` · ${formatValue(player.value)}`}
          </p>
        </div>
        {!hardMode && (
          <span className="font-display text-sm font-bold text-accent-green">
            {player.peakRating}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RugbyLeaguePlayerCard
        player={player}
        variant={selectable ? "recruitment" : "default"}
        hardMode={hardMode}
        equalHeight={equalHeight}
        compactMobile={compactMobile}
        className="flex-1"
      />
      {!selectable && canSign !== undefined && (
        <div className="mt-2 px-1">
          <RLTag variant={canSign ? "green" : "red"} compact>
            {canSign ? "Position Available" : "Position Full"}
          </RLTag>
        </div>
      )}
    </div>
  );
}
