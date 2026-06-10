"use client";

import type { SquadSlot } from "@/lib/types";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";
import { TryScorersPanel } from "./TryScorersPanel";

const RANK_STYLES = [
  "text-accent-gold",
  "text-gray-300",
  "text-amber-700",
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
  squad?: SquadSlot[];
  title?: string;
}

export function TopTryScorersCard({
  tryScorers,
  expectedTotalTries,
  title = "Top 3 Try Scorers",
}: TopTryScorersCardProps) {
  const topThree = tryScorers.slice(0, 3);
  if (topThree.length === 0) return null;

  return (
    <div className="rounded-lg border border-pitch-600/40 bg-pitch-900/50 p-3 sm:p-4">
      <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-gold">
        {title}
      </p>

      <div className="mt-3 space-y-2.5">
        {topThree.map((scorer, index) => {
          const colors = getClubColors(scorer.club);
          const rankStyle = RANK_STYLES[index] ?? "text-gray-400";

          return (
            <div
              key={scorer.playerId}
              className="relative overflow-hidden rounded-lg border border-pitch-700/50 bg-pitch-950/70"
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: colors.primary,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary} 0%, transparent 60%)`,
                }}
              />
              <div className="relative flex items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                <span
                  className={`font-display text-2xl font-black leading-none sm:text-3xl ${rankStyle}`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                    {scorer.name}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs font-semibold sm:text-sm"
                    style={{ color: colors.primary }}
                  >
                    {scorer.club}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400 sm:text-xs">
                    {formatScorerPosition(scorer)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl font-black text-accent-gold sm:text-3xl">
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

      <TryScorersPanel
        tryScorers={tryScorers}
        expectedTotalTries={expectedTotalTries}
      />
    </div>
  );
}
