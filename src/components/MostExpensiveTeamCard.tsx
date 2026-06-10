"use client";

import { memo } from "react";
import { formatValue } from "@/lib/players";
import type { TeamValueEntry } from "@/lib/team-value-comparison";
import { ClubNameLabel } from "./ClubNameLabel";

interface MostExpensiveTeamCardProps {
  userTeamName: string;
  userValue: number;
  mostExpensive: TeamValueEntry;
}

export const MostExpensiveTeamCard = memo(function MostExpensiveTeamCard({
  userTeamName,
  userValue,
  mostExpensive,
}: MostExpensiveTeamCardProps) {
  const isUser = mostExpensive.name === userTeamName;

  return (
    <div className="rounded-xl border border-pitch-600/40 bg-pitch-900/50 p-4 text-left">
      <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-gold">
        Most Expensive Squad This Season
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ClubNameLabel club={mostExpensive.name} variant="pill" />
        <span className="font-display text-lg font-black text-accent-gold">
          {formatValue(mostExpensive.value)}
        </span>
      </div>
      <p className="mt-3 text-sm text-gray-400">
        {isUser ? (
          <>
            Your squad was the most expensive in the competition at{" "}
            <span className="font-semibold text-white">
              {formatValue(userValue)}
            </span>
            .
          </>
        ) : (
          <>
            Your squad value:{" "}
            <span className="font-semibold text-white">
              {formatValue(userValue)}
            </span>
            . Highest seen:{" "}
            <span className="font-semibold text-accent-gold">
              {formatValue(mostExpensive.value)}
            </span>{" "}
            ({mostExpensive.name}).
          </>
        )}
      </p>
    </div>
  );
});
