"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Player } from "@/lib/types";
import {
  formatCareerTries,
  formatPlayerAge,
  formatPlayerDisplayName,
  formatValue,
} from "@/lib/players";
import { getCachedPlayerAchievements } from "@/lib/players/achievement-cache";
import { getValueTier } from "@/lib/players/ratings";
import { getNationalityAbbrev } from "@/lib/players/nationality";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";
import { AchievementChipList } from "./cards/AchievementChipList";
import {
  PlayerSpecialBadge,
  PlayerStatusBadge,
  resolvePlayerStatus,
} from "./cards/PlayerStatusBadge";
import { StatBox, TIER_STAT_SPAN_CLASS } from "./ui/StatBox";
import { BTN, CARD } from "@/lib/ui/design-system";

interface SlotRecruitPlayerCardProps {
  player: Player;
  teamYearLabel: string;
  hardMode?: boolean;
  clubColorOverride?: string;
  expanded?: boolean;
  disabled?: boolean;
  onToggleExpand: () => void;
  onSign: () => void;
}

/** Normal Mode pick card — compact name/rating/team-year; tap to expand for full stats. */
export function SlotRecruitPlayerCard({
  player,
  teamYearLabel,
  hardMode,
  clubColorOverride,
  expanded = false,
  disabled,
  onToggleExpand,
  onSign,
}: SlotRecruitPlayerCardProps) {
  const colors = getClubColors(clubColorOverride ?? player.club);
  const displayName = formatPlayerDisplayName(player);
  const status = resolvePlayerStatus(player);
  const isGoat = isGoatPlayer(player);
  const isSuperSam = isSuperSamHallasPlayer(player);
  const achievements = useMemo(
    () => getCachedPlayerAchievements(player, "compact"),
    [player.id]
  );
  const tier = getValueTier(player.peakRating);
  const maskValue = (value: string) => (hardMode ? "???" : value);
  const hiddenClass = hardMode ? "invisible select-none" : "";

  const appearancesValue =
    player.appearances !== undefined ? String(player.appearances) : "Unknown";

  const statusBadge =
    isSuperSam ? (
      <PlayerSpecialBadge variant="superSam" compact className={hiddenClass} />
    ) : isGoat ? (
      <PlayerSpecialBadge variant="goat" compact className={hiddenClass} />
    ) : status ? (
      <PlayerStatusBadge status={status} compact className={hiddenClass} />
    ) : null;

  return (
    <div
      className={`${CARD.base} flex h-full min-w-0 flex-col overflow-hidden transition ${
        expanded ? CARD.selected : "hover:border-accent-green/35"
      } ${disabled ? "opacity-50" : ""}`}
      style={{
        boxShadow: `inset 3px 0 0 ${colors.primary}`,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-expanded={expanded}
        onClick={onToggleExpand}
        className="btn-press group flex min-w-0 flex-col px-2.5 py-2 text-left disabled:cursor-not-allowed sm:px-3 sm:py-2.5"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 line-clamp-2 break-words font-display text-xs font-bold leading-tight text-white sm:text-sm">
            {displayName}
          </h3>
          <span
            className={`shrink-0 font-display font-bold leading-none text-accent-green ${
              hardMode ? "text-gray-600" : ""
            } text-sm sm:text-base`}
          >
            {hardMode ? "???" : player.peakRating}
            {!hardMode && (
              <span className="hidden sm:inline"> OVR</span>
            )}
          </span>
        </div>
        <p className="mt-1 min-w-0 line-clamp-2 break-words text-[10px] leading-snug text-gray-400 sm:text-xs">
          {teamYearLabel}
        </p>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-pitch-700/50 px-2 pb-2.5 pt-2 sm:px-3">
              {statusBadge && (
                <div
                  className="mb-2"
                  aria-hidden={hardMode || undefined}
                >
                  {statusBadge}
                </div>
              )}

              {achievements.length > 0 && (
                <div className={`mb-2 ${hiddenClass}`}>
                  <AchievementChipList
                    achievements={achievements}
                    compactMobile
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5">
                <StatBox
                  label="Position"
                  value={POSITION_LABELS[player.position]}
                  size="lg"
                  light
                  compact
                />
                <StatBox
                  label="Age"
                  value={formatPlayerAge(player)}
                  size="lg"
                  light
                  compact
                />
                <StatBox
                  label="Value"
                  value={maskValue(formatValue(player.value))}
                  size="lg"
                  light
                  compact
                />
                <StatBox
                  label="Years Active"
                  value={player.yearsActive}
                  size="lg"
                  light
                  compact
                  className="hidden sm:block"
                />
                <StatBox
                  label="Apps"
                  value={appearancesValue}
                  size="lg"
                  light
                  compact
                />
                <StatBox
                  label="Tries"
                  value={formatCareerTries(player.tries)}
                  size="lg"
                  light
                  compact
                />
                <StatBox
                  label="Nation"
                  value={
                    hardMode
                      ? "???"
                      : `${getNationalityAbbrev(player.nationality)} · ${player.nationality}`
                  }
                  size="lg"
                  light
                  compact
                  className="col-span-2 sm:col-span-1"
                />
                <StatBox
                  label="Squad"
                  value={teamYearLabel}
                  size="lg"
                  light
                  compact
                  className="col-span-2"
                />
                <StatBox
                  label="Tier"
                  value={maskValue(tier)}
                  size="lg"
                  light
                  compact
                  className={TIER_STAT_SPAN_CLASS}
                />
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={onSign}
                className={`mt-2.5 w-full ${BTN.base} ${BTN.primary} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Sign player
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
