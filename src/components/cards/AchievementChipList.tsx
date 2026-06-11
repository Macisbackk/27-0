"use client";

import { memo, useCallback, useState } from "react";
import type { PlayerAchievement } from "@/lib/players/achievements";
import { ACHIEVEMENT_TAG_VARIANT, RLTag } from "./rl-card";

interface AchievementChipListProps {
  achievements: PlayerAchievement[];
  compactMobile?: boolean;
  className?: string;
  /** When true, Dream Team years start expanded (e.g. player detail modal). */
  dreamTeamDefaultExpanded?: boolean;
}

const DreamTeamYearChip = memo(function DreamTeamYearChip({
  year,
}: {
  year: number;
}) {
  return (
    <span className="rl-tag-year" aria-label={`Dream Team ${year}`}>
      {year}
    </span>
  );
});

const DreamTeamCollapsibleChip = memo(function DreamTeamCollapsibleChip({
  years,
  compactMobile,
  defaultExpanded = false,
}: {
  years: readonly number[];
  compactMobile?: boolean;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const toggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setOpen((value) => !value);
  }, []);

  return (
    <div className="relative inline-flex max-w-full flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? "Collapse Dream Team years"
            : `Dream Team — ${years.length} selections`
        }
        onClick={toggle}
        className="inline-flex cursor-pointer border-0 bg-transparent p-0"
      >
        <RLTag
          variant={ACHIEVEMENT_TAG_VARIANT.purple}
          compact={compactMobile}
          className="gap-0.5"
        >
          Dream Team{" "}
          <span className="opacity-80" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </RLTag>
      </button>

      {open && (
        <div
          className={`absolute left-1/2 top-full z-30 mt-1 flex max-w-[min(100vw,14rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 overscroll-contain rounded-md border border-pitch-600/50 bg-pitch-950/95 px-1.5 py-1 shadow-lg ${
            years.length > 8 ? "max-h-16 overflow-y-auto" : ""
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {years.map((year) => (
            <DreamTeamYearChip key={year} year={year} />
          ))}
        </div>
      )}
    </div>
  );
});

function AchievementChipListInner({
  achievements,
  compactMobile,
  className = "",
  dreamTeamDefaultExpanded = false,
}: AchievementChipListProps) {
  if (achievements.length === 0) return null;

  return (
    <div
      className={`flex max-w-full flex-wrap items-start justify-center gap-1 px-1 py-0.5 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {achievements.map((achievement, index) => {
        if (achievement.dreamTeamYears?.length) {
          return (
            <DreamTeamCollapsibleChip
              key={`dream-team-${index}`}
              years={achievement.dreamTeamYears}
              compactMobile={compactMobile}
              defaultExpanded={dreamTeamDefaultExpanded}
            />
          );
        }

        return (
          <RLTag
            key={`${achievement.label}-${index}`}
            variant={ACHIEVEMENT_TAG_VARIANT[achievement.color]}
            compact={compactMobile}
          >
            {achievement.label}
          </RLTag>
        );
      })}
    </div>
  );
}

export const AchievementChipList = memo(AchievementChipListInner);
