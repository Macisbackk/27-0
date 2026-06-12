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

      <ul className={`space-y-2.5 ${compact ? "px-3 py-3" : "px-3 py-4 sm:px-4"}`}>
        {entries.map((entry) => {
          const widthPercent =
            maxWins > 0
              ? Math.round((entry.tournamentWins / maxWins) * 100)
              : 0;

          return (
            <li
              key={entry.teamName}
              className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[2rem_7rem_1fr_2.5rem] sm:gap-x-3"
            >
              <span
                className={`text-right text-xs font-bold sm:text-sm ${
                  entry.isLeader ? "text-accent-green" : "text-gray-500"
                }`}
              >
                {entry.rank}
              </span>

              <span className="col-span-1 truncate text-xs font-medium text-white sm:col-span-1 sm:text-sm">
                {entry.teamName}
              </span>

              <div className="col-span-3 min-w-0 sm:col-span-1 sm:col-start-3">
                <div className="h-5 overflow-hidden rounded-md bg-pitch-900/90 sm:h-6">
                  <div
                    className={`h-full rounded-md transition-all ${
                      entry.isLeader
                        ? "bg-accent-green"
                        : entry.tournamentWins > 0
                          ? "bg-pitch-600/80"
                          : "bg-pitch-800/40"
                    }`}
                    style={{
                      width: `${entry.tournamentWins > 0 ? Math.max(widthPercent, 8) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <span
                className={`col-start-3 row-start-1 text-right text-xs font-semibold sm:col-start-4 sm:row-start-auto sm:text-sm ${
                  entry.isLeader ? "text-accent-green" : "text-gray-300"
                }`}
              >
                {entry.tournamentWins}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
