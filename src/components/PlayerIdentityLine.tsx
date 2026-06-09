"use client";

import type { Player } from "@/lib/types";
import {
  formatPlayerIdentity,
  getNationalityAbbrev,
} from "@/lib/players/nationality";
import { POSITION_LABELS } from "@/lib/positions";

interface PlayerIdentityLineProps {
  player: Player;
  className?: string;
}

/** Nationality abbreviation + • position beneath player name. */
export function PlayerIdentityLine({
  player,
  className = "",
}: PlayerIdentityLineProps) {
  const abbrev = getNationalityAbbrev(player.nationality);
  const position = POSITION_LABELS[player.position];

  return (
    <p
      className={`player-identity-line mt-1.5 flex items-center gap-2 text-sm font-medium leading-snug text-gray-300 sm:text-base ${className}`}
    >
      <span className="font-display text-sm font-bold tracking-wider text-accent-green sm:text-base">
        {abbrev}
      </span>
      <span className="text-gray-600">•</span>
      <span className="text-base font-semibold text-white sm:text-[17px]">
        {position}
      </span>
    </p>
  );
}

export function PlayerIdentityCompact({ player }: { player: Player }) {
  return (
    <p className="player-identity-line text-sm font-medium text-gray-300">
      {formatPlayerIdentity(player)}
    </p>
  );
}
