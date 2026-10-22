"use client";

import { TYPO } from "@/lib/ui/typography";
import { MATCHDAY } from "@/lib/ui/design-system";

interface MatchdayScoreboardProps {
  filledCount: number;
  totalSlots: number;
  /** Average peak rating of drafted players (1 decimal). Hidden in hard mode. */
  averageSquadRating: number;
  hardMode?: boolean;
}

export function MatchdayScoreboard({
  filledCount,
  totalSlots,
  averageSquadRating,
  hardMode = false,
}: MatchdayScoreboardProps) {
  const showRating = !hardMode && filledCount > 0;

  return (
    <div
      className={`matchday-scoreboard relative overflow-hidden rounded-[20px] bg-pitch-900 ${MATCHDAY.cardPadding}`}
    >
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-theme-primary" />
            <p className={TYPO.cardHeading}>Squad Builder</p>
          </div>
          <p className={`mt-1 ${TYPO.label}`}>
            {filledCount} of {totalSlots} positions filled
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-pitch-950"
            role="progressbar"
            aria-valuenow={filledCount}
            aria-valuemin={0}
            aria-valuemax={totalSlots}
            aria-label="Squad fill progress"
          >
            <div
              className="h-full rounded-full bg-theme-primary transition-all duration-300 motion-reduce:transition-none"
              style={{
                width: `${Math.min(100, (filledCount / Math.max(1, totalSlots)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 items-stretch justify-items-center gap-2.5">
          <div className="w-full rounded-[16px] bg-pitch-800 px-3 py-2.5 text-center">
            <p className={TYPO.label}>Squad</p>
            <p className="fl-number mt-1 text-[28px] text-white">
              {filledCount}
              <span className="text-lg text-[color:var(--fl-muted)]">/{totalSlots}</span>
            </p>
          </div>

          <div className="w-full rounded-[16px] bg-pitch-800 px-3 py-2.5 text-center">
            <p className={TYPO.label}>Your Rating</p>
            <p className="fl-number mt-1 text-[28px] text-theme-primary">
              {showRating ? averageSquadRating.toFixed(1) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
