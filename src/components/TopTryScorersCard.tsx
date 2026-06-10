"use client";

import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { POSITION_LABELS } from "@/lib/positions";
import { TryScorerClubBadge } from "./TryScorerClubBadge";
import { TryScorersPanel } from "./TryScorersPanel";

const RANK_STYLES = [
  "text-accent-gold",
  "text-gray-300",
  "text-amber-700/90",
] as const;

function formatScorerPosition(scorer: PlayerTryTotal): string {
  if (scorer.playedPosition && scorer.playedPosition !== scorer.position) {
    return `${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`;
  }
  return POSITION_LABELS[scorer.position];
}

interface TopTryScorersCardProps {
  tryScorers: PlayerTryTotal[];
  expectedTotalTries: number;
  title?: string;
  includeFullList?: boolean;
}

export function TopTryScorersCard({
  tryScorers,
  expectedTotalTries,
  title = "Top 3 Try Scorers",
  includeFullList = true,
}: TopTryScorersCardProps) {
  const topThree = tryScorers.slice(0, 3);
  if (topThree.length === 0) return null;

  return (
    <div className="rounded-lg border border-pitch-600/40 bg-pitch-900/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-accent-gold">
        {title}
      </p>

      <div className="mt-2 space-y-2">
        {topThree.map((scorer, index) => {
          const rankStyle = RANK_STYLES[index] ?? "text-gray-400";

          return (
            <div
              key={scorer.playerId}
              className="rounded-lg border border-pitch-700/50 bg-pitch-950/60 px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`w-7 shrink-0 font-display text-xl font-black leading-none sm:text-2xl ${rankStyle}`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-white">
                    {scorer.name}
                  </p>
                  <div className="mt-1">
                    <TryScorerClubBadge club={scorer.club} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {formatScorerPosition(scorer)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl font-black text-accent-gold sm:text-2xl">
                    {scorer.tries}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {scorer.tries === 1 ? "Try" : "Tries"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {includeFullList && (
        <TryScorersPanel
          tryScorers={tryScorers}
          expectedTotalTries={expectedTotalTries}
        />
      )}
    </div>
  );
}
