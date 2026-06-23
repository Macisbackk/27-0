"use client";

import type { ReactNode } from "react";
import type { SquadSlot } from "@/lib/types";
import type { SeasonAward } from "@/lib/season-awards";
import { TeamSheet } from "./TeamSheet";
import { RLAwardCard } from "./cards/RLAwardCard";

interface SquadReviewSectionProps {
  squad: SquadSlot[];
  hardMode?: boolean;
  clubColorOverride?: string;
  /** Player awards (normal season review). */
  awards?: SeasonAward[];
  /** Right column content (e.g. playoff performers). */
  performance?: ReactNode;
  performanceTitle?: string;
  sectionTitle?: string;
}

export function SquadReviewSection({
  squad,
  hardMode = false,
  clubColorOverride,
  awards,
  performance,
  performanceTitle = "Performance",
  sectionTitle,
}: SquadReviewSectionProps) {
  const hasAwards = awards && awards.length > 0;
  const hasPerformance = !!performance;

  return (
    <div>
      {sectionTitle && (
        <p className="mb-3 text-center font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
          {sectionTitle}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Team Sheet
          </p>
          <TeamSheet
            squad={squad}
            hardMode={hardMode}
            clubColorOverride={clubColorOverride}
            interactive
          />
        </div>

        {(hasAwards || hasPerformance) && (
          <div className="min-w-0">
            <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {hasAwards ? "Player Awards" : performanceTitle}
            </p>
            {hasAwards ? (
              <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {awards.map((award) => (
                  <RLAwardCard
                    key={award.title}
                    title={award.title}
                    variant={award.variant}
                    playerName={award.playerName}
                    club={award.club}
                    detail={award.detail}
                    positionNote={award.positionNote}
                    ratingNote={award.ratingNote}
                    narrative={award.narrative}
                  />
                ))}
              </div>
            ) : (
              performance
            )}
          </div>
        )}
      </div>
    </div>
  );
}
