"use client";

import type { Player } from "@/lib/types";
import { formatPlayerAge } from "@/lib/players";
import {
  formatPlayerIdentity,
  getNationalityAbbrev,
} from "@/lib/players/nationality";
import {
  getPlayerDisplayClub,
  playerHasRunClub,
} from "@/lib/players/run-club";
import { POSITION_LABELS } from "@/lib/positions";

interface PlayerIdentityLineProps {
  player: Player;
  className?: string;
  compact?: boolean;
}

/** Position + era team (or nationality) beneath player name. */
export function PlayerIdentityLine({
  player,
  className = "",
  compact = false,
}: PlayerIdentityLineProps) {
  const position = POSITION_LABELS[player.position];
  const eraRun = playerHasRunClub(player);
  const displayClub = getPlayerDisplayClub(player);
  const ageLabel = formatPlayerAge(player);

  if (eraRun) {
    return (
      <div
        className={`player-identity-line ${compact ? "mt-0.5" : "mt-1.5"} ${className}`}
      >
        <p
          className={`font-semibold text-white ${
            compact ? "text-[10px]" : "text-base sm:text-[17px]"
          }`}
        >
          {position}
        </p>
        <p
          className={`font-display font-bold uppercase tracking-wide text-accent-gold ${
            compact ? "text-[9px]" : "text-[10px] sm:text-xs"
          }`}
        >
          {displayClub}
        </p>
        {ageLabel !== "Unknown" && (
          <p className={`${compact ? "text-[9px]" : "text-xs"} text-gray-500`}>
            Age {ageLabel}
          </p>
        )}
      </div>
    );
  }

  const abbrev = getNationalityAbbrev(player.nationality);

  return (
    <p
      className={`player-identity-line flex items-center font-medium leading-snug text-gray-300 ${
        compact
          ? "mt-0.5 gap-1 text-[10px]"
          : "mt-1.5 gap-2 text-sm sm:text-base"
      } ${className}`}
    >
      <span
        className={`shrink-0 font-display font-bold tracking-wider text-accent-green ${
          compact ? "text-[10px]" : "text-sm sm:text-base"
        }`}
      >
        {abbrev}
      </span>
      <span className="shrink-0 text-gray-600">•</span>
      <span
        className={`truncate font-semibold text-white ${
          compact ? "text-[10px]" : "text-base sm:text-[17px]"
        }`}
      >
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
