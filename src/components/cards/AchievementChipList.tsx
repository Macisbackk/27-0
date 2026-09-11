"use client";

import { memo, useCallback, useState } from "react";
import type { PlayerAchievement } from "@/lib/players/achievements";
import { playPanelClose, playPanelExpand } from "@/lib/sound";
import { ACHIEVEMENT_TAG_VARIANT, RLTag } from "./rl-card";

interface AchievementChipListProps {
  achievements: PlayerAchievement[];
  compactMobile?: boolean;
  className?: string;
}

const HonourYearChip = memo(function HonourYearChip({
  label,
  year,
}: {
  label: string;
  year: number;
}) {
  return (
    <span className="rl-tag-year" aria-label={`${label} ${year}`}>
      {year}
    </span>
  );
});

const HonourYearsCollapsibleChip = memo(function HonourYearsCollapsibleChip({
  label,
  years,
  variant,
  compactMobile,
}: {
  label: string;
  years: readonly number[];
  variant: (typeof ACHIEVEMENT_TAG_VARIANT)[keyof typeof ACHIEVEMENT_TAG_VARIANT];
  compactMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setOpen((value) => {
      if (value) playPanelClose();
      else playPanelExpand();
      return !value;
    });
  }, []);

  return (
    <div className="inline-flex w-full max-w-full flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? `Collapse ${label} years`
            : `${label} — ${years.length} awards`
        }
        onClick={toggle}
        className="inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0"
      >
        <RLTag variant={variant} compact={compactMobile} className="gap-0.5">
          {label}{" "}
          <span className="opacity-80" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </RLTag>
      </button>

      {open && (
        <div
          className={`mt-1 flex w-full max-w-full flex-wrap items-center justify-center gap-0.5 overscroll-contain rounded-md border border-pitch-600/50 bg-pitch-950/95 px-1.5 py-1 ${
            years.length > 8 ? "max-h-24 overflow-y-auto" : ""
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {years.map((year) => (
            <HonourYearChip key={year} label={label} year={year} />
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
}: AchievementChipListProps) {
  if (achievements.length === 0) return null;

  return (
    <div
      className={`flex max-w-full min-w-0 flex-wrap items-start justify-center gap-1 px-0.5 py-0.5 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {achievements.map((achievement, index) => {
        if (achievement.dreamTeamYears?.length) {
          return (
            <HonourYearsCollapsibleChip
              key={`dream-team-${index}`}
              label="Dream Team"
              years={achievement.dreamTeamYears}
              variant={ACHIEVEMENT_TAG_VARIANT.purple}
              compactMobile={compactMobile}
            />
          );
        }

        if (achievement.goldenBootYears?.length) {
          return (
            <HonourYearsCollapsibleChip
              key={`golden-boot-${index}`}
              label="Golden Boot"
              years={achievement.goldenBootYears}
              variant={ACHIEVEMENT_TAG_VARIANT.gold}
              compactMobile={compactMobile}
            />
          );
        }

        if (achievement.leagueLeadersYears?.length) {
          return (
            <HonourYearsCollapsibleChip
              key={`league-leaders-${index}`}
              label="League Leaders"
              years={achievement.leagueLeadersYears}
              variant={ACHIEVEMENT_TAG_VARIANT.silver}
              compactMobile={compactMobile}
            />
          );
        }

        if (achievement.superLeagueChampionYears?.length) {
          return (
            <HonourYearsCollapsibleChip
              key={`sl-champion-${index}`}
              label="Super League Champion"
              years={achievement.superLeagueChampionYears}
              variant={ACHIEVEMENT_TAG_VARIANT.green}
              compactMobile={compactMobile}
            />
          );
        }

        if (achievement.challengeCupYears?.length) {
          return (
            <HonourYearsCollapsibleChip
              key={`challenge-cup-${index}`}
              label="Challenge Cup Winner"
              years={achievement.challengeCupYears}
              variant={ACHIEVEMENT_TAG_VARIANT.gold}
              compactMobile={compactMobile}
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
