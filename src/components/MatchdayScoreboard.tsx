"use client";

import { TYPO } from "@/lib/ui/typography";

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

  // One compact strip so the whole team sheet fits on a phone screen above the action bar.
  return (
    <div className="matchday-scoreboard flex items-center gap-4 rounded-[20px] bg-pitch-900 px-4 py-3">
      <div className="min-w-0 flex-1 text-left">
        <p className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-white">Squad Builder</span>
          <span className={TYPO.label}>
            {filledCount} of {totalSlots}
          </span>
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
      <div className="shrink-0 text-right">
        <p className={TYPO.label}>Your Rating</p>
        <p className="fl-number mt-0.5 text-[26px] leading-none text-theme-primary">
          {showRating ? averageSquadRating.toFixed(1) : "—"}
        </p>
      </div>
    </div>
  );
}
