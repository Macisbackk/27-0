"use client";

import { getPlayerById } from "@/lib/players";
import { withEraYear } from "@/lib/players/player-age";
import { withRunClub } from "@/lib/players/run-club";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface EraBenchRosterProps {
  benchPlayerIds: string[];
  benchPositions?: Position[];
  eraYear?: number;
  runClub?: string;
  hardMode?: boolean;
}

export function EraBenchRoster({
  benchPlayerIds,
  benchPositions,
  eraYear,
  runClub,
  hardMode = false,
}: EraBenchRosterProps) {
  if (benchPlayerIds.length === 0) return null;

  return (
    <div className={`${CARD.inset} mt-3 overflow-hidden`}>
      <p className={`border-b border-pitch-700/40 px-3 py-2 ${TYPO.statLabel}`}>
        Bench · jerseys 14–17
      </p>
      <ul className="divide-y divide-pitch-700/35">
        {benchPlayerIds.map((id, index) => {
          const raw = getPlayerById(id);
          if (!raw) return null;
          let player = eraYear !== undefined ? withEraYear(raw, eraYear) : raw;
          if (runClub) {
            player = withRunClub(player, runClub, { eraYear });
          }
          const jersey = 14 + index;
          const position =
            benchPositions?.[index] ?? player.position;

          return (
            <li
              key={`${id}-${jersey}`}
              className="flex min-w-0 items-center gap-2 px-3 py-2"
            >
              <span className="w-6 shrink-0 text-center font-display text-xs font-bold text-accent-gold">
                {jersey}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-white">
                {player.name}
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 sm:text-[11px]">
                {POSITION_SHORT[position]}
              </span>
              {!hardMode && (
                <span className="shrink-0 font-display text-sm font-bold text-accent-green">
                  {player.peakRating}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
