"use client";

import type { CupTeamWinsLeaderboardRow } from "@/lib/storage/cup-team-wins";
import { TYPO } from "@/lib/ui/typography";

interface CupTeamWinsBarGraphProps {
  entries: CupTeamWinsLeaderboardRow[];
  totalCups: number;
  emptyMessage?: string;
}

export function CupTeamWinsBarGraph({
  entries,
  totalCups,
  emptyMessage = "No Challenge Cup wins recorded yet.",
}: CupTeamWinsBarGraphProps) {
  const leaders = entries.filter((entry) => entry.tournamentWins > 0);

  if (leaders.length === 0) {
    return (
      <p className={`py-8 text-center ${TYPO.bodySm} text-gray-400`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className={TYPO.bodySm}>
        {totalCups} tournament win{totalCups === 1 ? "" : "s"} recorded across all
        clubs.
      </p>
      <ul className="space-y-3" aria-label="Challenge Cup team wins">
        {leaders.map((entry) => (
          <li key={entry.teamName}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className={`${TYPO.body} font-medium text-gray-100`}>
                {entry.rank}. {entry.teamName}
              </span>
              <span className={`${TYPO.bodySm} tabular-nums text-accent-green`}>
                {entry.tournamentWins}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-pitch-800"
              role="img"
              aria-label={`${entry.teamName}: ${entry.tournamentWins} wins`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  entry.isLeader ? "bg-accent-green" : "bg-pitch-500"
                }`}
                style={{ width: `${Math.max(entry.barPercent, entry.tournamentWins > 0 ? 4 : 0)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
