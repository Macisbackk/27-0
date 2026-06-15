"use client";

import type { Player } from "@/lib/types";
import {
  RugbyLeaguePlayerCard,
  PITCH_CARD_SIZE_CLASS,
} from "./cards/RugbyLeaguePlayerCard";

interface SquadPlayerCardProps {
  player: Player;
  compact?: boolean;
  hardMode?: boolean;
  clubColorOverride?: string;
  className?: string;
}

export { PITCH_CARD_SIZE_CLASS };

export function SquadPlayerCard({
  player,
  compact,
  hardMode,
  clubColorOverride,
  className = "",
}: SquadPlayerCardProps) {
  const defaultSizeClass = compact
    ? "h-[84px] w-[56px] sm:h-[88px] sm:w-[60px]"
    : PITCH_CARD_SIZE_CLASS;

  return (
    <RugbyLeaguePlayerCard
      player={player}
      variant="pitch"
      compact={compact}
      hardMode={hardMode}
      clubColorOverride={clubColorOverride}
      className={className || defaultSizeClass}
    />
  );
}
