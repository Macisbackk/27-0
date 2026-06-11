"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerAchievement } from "@/lib/players/achievements";
import { ACHIEVEMENT_TAG_VARIANT, RLTag } from "./rl-card";

interface AchievementChipListProps {
  achievements: PlayerAchievement[];
  compactMobile?: boolean;
  className?: string;
  /** When true, Dream Team years start expanded (e.g. player detail modal). */
  dreamTeamDefaultExpanded?: boolean;
}

function DreamTeamYearChip({
  year,
  compactMobile,
}: {
  year: number;
  compactMobile?: boolean;
}) {
  return (
    <span
      className={`rl-tag-year ${compactMobile ? "text-[8px]" : ""}`}
      aria-label={`Dream Team ${year}`}
    >
      {year}
    </span>
  );
}

function DreamTeamCollapsibleChip({
  years,
  compactMobile,
  defaultExpanded = false,
}: {
  years: number[];
  compactMobile?: boolean;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <div className="inline-flex max-w-full flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? "Collapse Dream Team years"
            : `Dream Team — ${years.length} selections`
        }
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
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

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-full overflow-hidden"
          >
            <div
              className={`mt-1 flex w-full max-w-full flex-wrap items-center justify-center gap-0.5 overscroll-contain px-0.5 ${
                years.length > 8 ? "max-h-16 overflow-y-auto" : ""
              }`}
            >
              {years.map((year) => (
                <DreamTeamYearChip
                  key={year}
                  year={year}
                  compactMobile={compactMobile}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AchievementChipList({
  achievements,
  compactMobile,
  className = "",
  dreamTeamDefaultExpanded = false,
}: AchievementChipListProps) {
  if (achievements.length === 0) return null;

  return (
    <div
      className={`flex max-w-full flex-wrap items-start justify-center gap-1 px-1 py-0.5 ${className}`}
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
