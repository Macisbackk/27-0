"use client";

import type { ReactNode } from "react";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import type { SeasonAward } from "@/lib/season-awards";
import type { SquadSlot } from "@/lib/types";
import { TeamSheet } from "./TeamSheet";
import { RLAwardCard } from "./cards/RLAwardCard";
import { TryScorersSection } from "./TryScorersSection";

interface SquadReviewSectionProps {
  squad: SquadSlot[];
  hardMode?: boolean;
  clubColorOverride?: string;
  awards?: SeasonAward[];
  tryScorers?: PlayerTryTotal[];
  expectedTotalTries?: number;
  totalMatches?: number;
  performance?: ReactNode;
  performanceTitle?: string;
  sectionTitle?: string;
}

export function SquadReviewSection({
  squad,
  hardMode = false,
  clubColorOverride,
  awards,
  tryScorers,
  expectedTotalTries,
  totalMatches,
  performance,
  performanceTitle = "Performance",
  sectionTitle,
}: SquadReviewSectionProps) {
  const hasAwards = awards && awards.length > 0;
  const hasPerformance = !!performance;
  const hasTryScorers = tryScorers && tryScorers.length > 0;
  const hasRightColumn = hasAwards || hasPerformance || hasTryScorers;

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
            tryScorers={tryScorers}
            awards={awards}
            totalMatches={totalMatches}
          />
        </div>

        {hasRightColumn && (
          <div className="min-w-0 space-y-4">
            {hasAwards && (
              <div>
                <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Player Awards
                </p>
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
              </div>
            )}

            {hasPerformance && (
              <div>
                <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {performanceTitle}
                </p>
                {performance}
              </div>
            )}

            {hasTryScorers && (
              <div>
                <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Try Scorers
                </p>
                <TryScorersSection
                  tryScorers={tryScorers}
                  expectedTotalTries={expectedTotalTries ?? 0}
                  squad={squad}
                  compact
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
