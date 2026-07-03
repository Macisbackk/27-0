"use client";

import { formatValue } from "@/lib/players";
import { TYPO } from "@/lib/ui/typography";

interface MatchdayScoreboardProps {
  filledCount: number;
  totalSlots: number;
  totalValue: number;
}

export function MatchdayScoreboard({
  filledCount,
  totalSlots,
  totalValue,
}: MatchdayScoreboardProps) {
  return (
    <div className="matchday-scoreboard relative overflow-hidden rounded-xl border border-white/10 px-4 py-3 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-pitch-900/40 via-transparent to-pitch-900/40" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-green" />
            <span className={`${TYPO.sectionLabel} text-accent-green`}>
              Super League
            </span>
          </div>
          <div>
            <p className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base">
              Squad Builder
            </p>
            <p className={`${TYPO.bodySm} uppercase tracking-wider`}>
              {filledCount} of {totalSlots} positions filled
            </p>
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
            <p className={`${TYPO.statLabel} text-accent-gold/80`}>Squad Value</p>
            <p className="font-display text-xl font-black text-accent-gold sm:text-2xl">
              {totalValue > 0 ? formatValue(totalValue) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
