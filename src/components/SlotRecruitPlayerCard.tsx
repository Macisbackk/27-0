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
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import { playUiClick } from "@/lib/sound";
import { AchievementChipList } from "./cards/AchievementChipList";
import {
  PlayerSpecialBadge,
  PlayerStatusBadge,
  resolvePlayerStatus,
} from "./cards/PlayerStatusBadge";
import { StatBox, TIER_STAT_SPAN_CLASS } from "./ui/StatBox";
import { CARD } from "@/lib/ui/design-system";

interface SlotRecruitPlayerCardProps {
  player: Player;
  teamYearLabel: string;
  hardMode?: boolean;
  clubColorOverride?: string;
  statsExpanded?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggleStats: () => void;
}

/** Normal Mode pick card — tap to sign; View Stats for full details. */
export function SlotRecruitPlayerCard({
  player,
  teamYearLabel,
  hardMode,
  clubColorOverride,
  statsExpanded = false,
  disabled,
  onSelect,
  onToggleStats,
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
      className={`${CARD.base} flex h-full min-w-0 flex-col overflow-hidden transition hover:border-accent-green/35 ${
        disabled ? "opacity-50" : ""
      }`}
      style={{
        boxShadow: `inset 3px 0 0 ${colors.primary}`,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="btn-press group flex min-w-0 flex-col px-2.5 pt-2 pb-1 text-left disabled:cursor-not-allowed sm:px-3 sm:pt-2.5 sm:pb-1.5"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 line-clamp-2 break-words font-display text-xs font-bold leading-tight text-white sm:text-sm">
            {displayName}
          </h3>
          <div className="flex max-w-[44%] shrink-0 flex-col items-end min-[480px]:max-w-[48%]">
            <p
              className={`text-right font-display font-bold leading-none text-accent-green ${
                hardMode ? "text-gray-600" : ""
              } text-sm sm:text-base`}
            >
              {hardMode ? "???" : player.peakRating}
              {!hardMode && <span className="hidden sm:inline"> OVR</span>}
            </p>
            <p className="mt-0.5 line-clamp-2 text-right text-[10px] font-semibold leading-snug text-accent-green/90 sm:text-[11px]">
              {formatPlayerPositionLabel(player, { short: false })}
            </p>
          </div>
        </div>
        <p className="mt-1 min-w-0 line-clamp-2 break-words text-[10px] leading-snug text-gray-400 sm:text-xs">
          {teamYearLabel}
        </p>
      </button>

      <div className="px-2.5 pb-1.5 sm:px-3 sm:pb-2">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={statsExpanded}
          onClick={(event) => {
            event.stopPropagation();
            playUiClick();
            onToggleStats();
          }}
          className="rounded-md border border-pitch-600/60 bg-pitch-950/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 transition hover:border-accent-green/35 hover:text-accent-green disabled:cursor-not-allowed sm:text-[10px]"
        >
          {statsExpanded ? "Close" : "View Stats"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {statsExpanded && (
          <motion.div
            key="stats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-pitch-700/50 px-2 pb-2 pt-1.5 sm:px-3 sm:pt-2">
              {statusBadge && (
                <div className="mb-2" aria-hidden={hardMode || undefined}>
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
                  value={formatPlayerPositionLabel(player, { short: false })}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
