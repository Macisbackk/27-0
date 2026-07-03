"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerSeasonSummary } from "@/lib/manager/types";
import { ManagerSectionCard } from "@/components/manager/manager-ui";

interface ManagerSeasonRecapCardProps {
  club: string;
  seasonYear: number;
  summary: ManagerSeasonSummary;
}

export function ManagerSeasonRecapCard({
  club,
  seasonYear,
  summary,
}: ManagerSeasonRecapCardProps) {
  const trophyLine =
    summary.trophies.length > 0
      ? summary.trophies.join(" · ")
      : "No silverware this year";

  return (
    <ManagerSectionCard title="Season recap" variant="elevated" accent="gold">
      <div className={`mt-2 ${SPACING.stackSm} ${TYPO.bodySm} text-pitch-300`}>
        <p>
          <span className="font-semibold text-white">{club}</span> · {seasonYear}
        </p>
        <p>
          Finished{" "}
          <span className="font-semibold text-accent-gold">
            {summary.position}
            {summary.position === 1
              ? "st"
              : summary.position === 2
                ? "nd"
                : summary.position === 3
                  ? "rd"
                  : "th"}
          </span>{" "}
          · {summary.wins}W-{summary.losses}L
        </p>
        <p>Trophies: {trophyLine}</p>
        {summary.averageAttendance > 0 && (
          <p>Avg attendance: {summary.averageAttendance.toLocaleString()}</p>
        )}
        <p className="text-pitch-400">{summary.boardVerdict}</p>
      </div>
    </ManagerSectionCard>
  );
}
