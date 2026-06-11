"use client";

import type { SquadSlot } from "@/lib/types";
import { getDraftPositionRemainingDisplay } from "@/lib/game/draft-positions";
import { TYPO } from "@/lib/ui/typography";

interface DraftPositionsRemainingProps {
  squad: SquadSlot[];
  compact?: boolean;
}

export function DraftPositionsRemaining({
  squad,
  compact = false,
}: DraftPositionsRemainingProps) {
  const entries = getDraftPositionRemainingDisplay(squad);

  return (
    <div
      className={`mx-auto w-full max-w-md text-center ${
        compact ? "px-1 py-1" : "px-2 py-1.5"
      }`}
    >
      <p
        className={`${TYPO.statLabel} ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        Positions Remaining
      </p>
      {entries.length === 0 ? (
        <p
          className={`mt-1.5 font-display font-bold text-accent-green ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          Squad complete
        </p>
      ) : (
        <div
          className={`mt-1.5 flex flex-wrap items-center justify-center gap-1 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {entries.map((entry) => {
            const label =
              entry.remaining > 1
                ? `${entry.label} x${entry.remaining}`
                : entry.label;

            return (
              <span
                key={entry.key}
                className="inline-flex shrink-0 items-center rounded-full border border-accent-green/35 bg-accent-green/10 px-2 py-0.5 font-display font-bold text-accent-green"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
