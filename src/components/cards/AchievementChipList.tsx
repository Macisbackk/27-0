"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerAchievement } from "@/lib/players/achievements";
import { ACHIEVEMENT_TAG_VARIANT, RLTag } from "./rl-card";

interface AchievementChipListProps {
  achievements: PlayerAchievement[];
  compactMobile?: boolean;
  className?: string;
}

function DreamTeamCollapsibleChip({
  years,
  compactMobile,
}: {
  years: number[];
  compactMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);

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
            className="w-full overflow-hidden"
          >
            <ul
              className={`mt-1 max-h-20 w-full overflow-y-auto overscroll-contain rounded-md border border-pitch-600/40 bg-pitch-950/80 px-2 py-1 text-left ${
                compactMobile ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {years.map((year) => (
                <li
                  key={year}
                  className="py-0.5 leading-tight text-purple-200/90"
                >
                  • {year}
                </li>
              ))}
            </ul>
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
}: AchievementChipListProps) {
  if (achievements.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-start justify-center gap-1 px-1 py-0.5 ${className}`}
    >
      {achievements.map((achievement, index) => {
        if (achievement.dreamTeamYears?.length) {
          return (
            <DreamTeamCollapsibleChip
              key={`dream-team-${index}`}
              years={achievement.dreamTeamYears}
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
