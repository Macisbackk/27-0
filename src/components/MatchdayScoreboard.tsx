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

  return (
    <div className="matchday-scoreboard relative overflow-hidden border border-white/10 bg-[#080c0d] px-4 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-theme-primary" />
          </div>
          <div>
            <p className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base">
              Squad Builder
            </p>
            <p className={`${TYPO.bodySm} uppercase tracking-wider`}>
              {filledCount} of {totalSlots} positions filled
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-pitch-800/80"
              role="progressbar"
              aria-valuenow={filledCount}
              aria-valuemin={0}
              aria-valuemax={totalSlots}
              aria-label="Squad fill progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-theme-primary/80 to-theme-primary transition-all duration-300 motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, (filledCount / Math.max(1, totalSlots)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-center">
            <p className={`${TYPO.statLabel}`}>Squad</p>
            <p className="font-display text-2xl font-black text-white">
              {filledCount}
              <span className="text-base text-gray-500">/{totalSlots}</span>
            </p>
          </div>

          <div className="scoreboard-value-panel rounded-lg px-4 py-2 text-right">
            <p className={`${TYPO.statLabel} text-accent-gold/80`}>
              Average Squad Rating
            </p>
            <p className="font-display text-xl font-black text-accent-gold sm:text-2xl">
              {showRating ? averageSquadRating.toFixed(1) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
