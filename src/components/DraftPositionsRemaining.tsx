"use client";

import type { SquadSlot } from "@/lib/types";
import { getPositionRemainingEntries } from "@/lib/game/draft-positions";
import { TYPO } from "@/lib/ui/typography";

interface DraftPositionsRemainingProps {
  squad: SquadSlot[];
  compact?: boolean;
}

export function DraftPositionsRemaining({
  squad,
  compact = false,
}: DraftPositionsRemainingProps) {
  const entries = getPositionRemainingEntries(squad);

  return (
    <div
      className={`rounded-lg border border-pitch-600/50 bg-pitch-900/60 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
    >
      <p
        className={`${TYPO.sectionTitle} ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        Positions Remaining
      </p>
      <ul
        className={`mt-1.5 flex flex-wrap gap-1.5 ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {entries.map((entry) => {
          const filled = entry.remaining === 0;
          const label =
            entry.remaining > 1
              ? `${entry.label} x${entry.remaining}`
              : entry.label;

          return (
            <li
              key={entry.position}
              className={`rounded-full border px-2 py-0.5 ${
                filled
                  ? "border-pitch-700/60 bg-pitch-900/40 text-gray-600 line-through"
                  : "border-accent-green/30 bg-accent-green/10 text-accent-green"
              }`}
            >
              {filled ? `${entry.label} ✓` : label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
