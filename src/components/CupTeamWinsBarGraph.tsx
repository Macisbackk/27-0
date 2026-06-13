"use client";

import type { CupTeamWinsLeaderboardRow } from "@/lib/storage/cup-team-wins";

interface CupTeamWinsBarGraphProps {
  entries: CupTeamWinsLeaderboardRow[];
  totalCups?: number;
  compact?: boolean;
}

export function CupTeamWinsBarGraph({
  entries,
  totalCups,
  compact = false,
}: CupTeamWinsBarGraphProps) {
  const maxWins = entries.reduce(
    (max, entry) => Math.max(max, entry.tournamentWins),
    0
  );

  return (
    <section className="matchday-panel overflow-hidden">
      <div className="border-b border-pitch-600/50 px-4 py-3">
        <h2
          className={`font-display font-bold uppercase tracking-wider text-accent-gold ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Challenge Cup Team Wins
        </h2>
        {totalCups !== undefined && totalCups > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {totalCups} tournament win{totalCups !== 1 ? "s" : ""} recorded
          </p>
        )}
      </div>

      <ul className={`space-y-3 ${compact ? "px-3 py-3" : "px-3 py-4 sm:px-4"}`}>
        {entries.map((entry) => {
          const widthPercent =
            maxWins > 0
              ? Math.round((entry.tournamentWins / maxWins) * 100)
              : 0;

          return (
            <li key={entry.teamName} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`min-w-0 flex-1 break-words text-xs font-medium leading-snug sm:text-sm ${
                    entry.isLeader ? "text-accent-green" : "text-white"
                  }`}
                >
                  <span
                    className={`mr-2 text-[10px] font-bold sm:text-xs ${
                      entry.isLeader ? "text-accent-green" : "text-gray-500"
                    }`}
                  >
                    {entry.rank}.
                  </span>
                  {entry.teamName}
                </span>
                <span
                  className={`shrink-0 text-xs font-semibold sm:text-sm ${
                    entry.isLeader ? "text-accent-green" : "text-gray-300"
                  }`}
                >
                  {entry.tournamentWins}
                </span>
              </div>

              <div className="mt-1.5 h-4 overflow-hidden rounded-md bg-pitch-900/90 sm:h-5">
                <div
                  className={`h-full rounded-md transition-all ${
                    entry.isLeader
                      ? "bg-accent-green"
                      : entry.tournamentWins > 0
                        ? "bg-pitch-600/80"
                        : "bg-pitch-800/40"
                  }`}
                  style={{
                    width: `${entry.tournamentWins > 0 ? Math.max(widthPercent, entry.isLeader ? 12 : 4) : 0}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
