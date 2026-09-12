"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACHIEVEMENT_DEFINITIONS,
  HIDDEN_ACHIEVEMENT_DESCRIPTION,
  HIDDEN_ACHIEVEMENT_LABEL,
  type AchievementCategory,
  type AchievementDefinition,
} from "@/lib/achievements/achievementDefinitions";
import {
  getAchievementProgress,
  getUnlockedAchievements,
} from "@/lib/achievements/achievementEngine";
import { formatClubFunds } from "@/lib/club-funds";
import { SectionCard } from "@/components/ui/SectionCard";
import { GameBadge } from "@/components/ui/GameBadge";
import { GameButton } from "@/components/ui/GameButton";
import { GameStatCard } from "@/components/ui/GameStatCard";
import { GameTabs } from "@/components/ui/GameTabs";
import { MANAGER } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ACHIEVEMENTS_CHANGED_EVENT } from "@/lib/achievements/achievementStorage";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

type CategoryFilter = "all" | AchievementCategory;
type StatusFilter = "all" | "locked" | "unlocked";

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "normal", label: "Quick Mode" },
  { id: "store", label: "Store" },
  { id: "quiz", label: "Mini Games" },
  { id: "easter-egg", label: "Easter Eggs" },
];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "locked", label: "Locked" },
];

const VISIBLE_ACHIEVEMENTS = (
  SHOW_DAILY_CHALLENGE_UI
    ? ACHIEVEMENT_DEFINITIONS
    : ACHIEVEMENT_DEFINITIONS.filter((def) => !def.id.startsWith("daily-"))
).filter((def) => def.category !== "challenge-cup");

function formatUnlockDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AchievementRow({
  def,
  unlockedAt,
}: {
  def: AchievementDefinition;
  unlockedAt?: string;
}) {
  const isUnlocked = Boolean(unlockedAt);
  const hiddenLocked = def.hidden && !isUnlocked;
  const name = hiddenLocked ? HIDDEN_ACHIEVEMENT_LABEL : def.name;
  const progress =
    !hiddenLocked && def.target
      ? getAchievementProgress(def.id)
      : null;

  return (
    <li className="rounded-lg border border-pitch-700/40 bg-pitch-900/30 p-3 text-left">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{name}</p>
          {hiddenLocked ? (
            <p className={`mt-0.5 ${TYPO.bodySm}`}>
              {HIDDEN_ACHIEVEMENT_DESCRIPTION}
            </p>
          ) : null}
          {progress && !isUnlocked ? (
            <div className="mt-2">
              <p className="text-[10px] text-gray-400">
                Progress: {progress.current} / {progress.target}
              </p>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-pitch-800"
                role="progressbar"
                aria-valuenow={progress.current}
                aria-valuemin={0}
                aria-valuemax={progress.target}
              >
                <div
                  className="h-full rounded-full bg-theme-primary transition-all"
                  style={{
                    width: `${Math.min(100, (progress.current / progress.target) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          {def.rewardClubFunds && (!hiddenLocked || isUnlocked) ? (
            <p className="mt-1.5 text-[11px] text-accent-gold">
              Reward: {formatClubFunds(def.rewardClubFunds)}
            </p>
          ) : null}
          {isUnlocked && unlockedAt ? (
            <p className="mt-1 text-[10px] text-gray-500">
              Unlocked {formatUnlockDate(unlockedAt)}
            </p>
          ) : null}
        </div>
        <GameBadge tone={isUnlocked ? "win" : "muted"}>
          {isUnlocked ? "Unlocked" : "Locked"}
        </GameBadge>
      </div>
    </li>
  );
}

export function AchievementsSection() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onChange = () => setRefreshKey((k) => k + 1);
    window.addEventListener(ACHIEVEMENTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ACHIEVEMENTS_CHANGED_EVENT, onChange);
  }, []);

  const unlockedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of getUnlockedAchievements()) {
      map.set(row.id, row.unlockedAt);
    }
    return map;
  }, [refreshKey]);

  const visible = VISIBLE_ACHIEVEMENTS.filter((def) => {
    const isUnlocked = unlockedMap.has(def.id);
    if (category !== "all" && def.category !== category) return false;
    if (status === "unlocked" && !isUnlocked) return false;
    if (status === "locked" && isUnlocked) return false;
    return true;
  });

  const totalUnlocked = VISIBLE_ACHIEVEMENTS.filter((def) =>
    unlockedMap.has(def.id)
  ).length;
  const totalAvailable = VISIBLE_ACHIEVEMENTS.length;

  return (
    <div id="achievements" className="scroll-mt-24">
      <SectionCard title="Achievements">
        <div className="mx-auto max-w-xs">
          <GameStatCard
            label="Unlocked"
            value={`${totalUnlocked} / ${totalAvailable}`}
            neutral
          />
        </div>

        <div className="mt-4 space-y-3">
          <GameTabs
            tabs={CATEGORY_TABS}
            active={category}
            onChange={setCategory}
            ariaLabel="Achievement categories"
            scrollable
          />
          <div className={MANAGER.chipRow}>
            {STATUS_TABS.map((tab) => (
              <GameButton
                key={tab.id}
                type="button"
                size="sm"
                fullWidth={false}
                variant={status === tab.id ? "theme" : "ghost"}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
              </GameButton>
            ))}
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {visible.map((def) => (
            <AchievementRow
              key={def.id}
              def={def}
              unlockedAt={unlockedMap.get(def.id)}
            />
          ))}
        </ul>
        {visible.length === 0 ? (
          <p className={`mt-4 text-center ${TYPO.bodySm}`}>
            No achievements match these filters.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
