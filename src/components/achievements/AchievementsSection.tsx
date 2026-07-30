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
  countAchievementPoints,
  getAchievementProgress,
  getUnlockedAchievements,
} from "@/lib/achievements/achievementEngine";
import { formatClubFunds } from "@/lib/club-funds";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameBadge } from "@/components/ui/GameBadge";
import { GameButton } from "@/components/ui/GameButton";
import { GameStatCard } from "@/components/ui/GameStatCard";
import { GameTabs } from "@/components/ui/GameTabs";
import { TYPO } from "@/lib/ui/typography";
import { ACHIEVEMENTS_CHANGED_EVENT } from "@/lib/achievements/achievementStorage";

type CategoryFilter = "all" | AchievementCategory;
type StatusFilter = "all" | "locked" | "unlocked";

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manager", label: "Manager" },
  { id: "normal", label: "Normal" },
  { id: "challenge-cup", label: "Challenge Cup" },
  { id: "store", label: "Store" },
  { id: "easter-egg", label: "Easter Eggs" },
];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "locked", label: "Locked" },
];

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
  const description = hiddenLocked
    ? HIDDEN_ACHIEVEMENT_DESCRIPTION
    : def.description;
  const progress =
    !hiddenLocked && def.target
      ? getAchievementProgress(def.id)
      : null;

  return (
    <li className="rounded-lg border border-pitch-700/40 bg-pitch-900/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{name}</p>
          <p className={`mt-0.5 ${TYPO.bodySm}`}>{description}</p>
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

  const visible = ACHIEVEMENT_DEFINITIONS.filter((def) => {
    const isUnlocked = unlockedMap.has(def.id);
    if (category !== "all" && def.category !== category) return false;
    if (status === "unlocked" && !isUnlocked) return false;
    if (status === "locked" && isUnlocked) return false;
    return true;
  });

  const totalUnlocked = unlockedMap.size;
  const totalAvailable = ACHIEVEMENT_DEFINITIONS.length;
  const points = countAchievementPoints();

  return (
    <GamePanel padded label="Achievements">
      <div className="grid gap-3 sm:grid-cols-3">
        <GameStatCard
          label="Unlocked"
          value={`${totalUnlocked} / ${totalAvailable}`}
          neutral
        />
        <GameStatCard label="Points" value={String(points)} neutral />
        <GameStatCard
          label="Remaining"
          value={String(totalAvailable - totalUnlocked)}
          neutral
          muted
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
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <GameButton
              key={tab.id}
              type="button"
              size="sm"
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
        <p className={`mt-4 ${TYPO.bodySm}`}>No achievements match these filters.</p>
      ) : null}
    </GamePanel>
  );
}
