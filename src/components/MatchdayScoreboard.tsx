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
      className={`matchday-scoreboard relative overflow-hidden border border-white/10 bg-[#080c0d] shadow-[0_14px_34px_rgba(0,0,0,0.28)] ${MATCHDAY.cardPadding}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-theme-primary" />
            <p className={TYPO.sectionTitle}>Squad Builder</p>
          </div>
          <p className={`mt-1 ${TYPO.bodySm} uppercase tracking-wider`}>
            {filledCount} of {totalSlots} positions filled
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-pitch-800/80"
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

        <div className="grid w-full max-w-md grid-cols-2 items-center justify-items-center gap-3">
          <div className="w-full text-center">
            <p className={TYPO.statLabel}>Squad</p>
            <p className={TYPO.statValueLg}>
              {filledCount}
              <span className="text-base text-gray-500">/{totalSlots}</span>
            </p>
          </div>

          <div className="scoreboard-value-panel w-full rounded-lg px-3 py-2 text-center">
            <p className={TYPO.keyLabel}>Your Rating</p>
            <p className={TYPO.statValueLg}>
              {showRating ? averageSquadRating.toFixed(1) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
