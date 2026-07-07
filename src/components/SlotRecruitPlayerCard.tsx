"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameButton } from "@/components/ui/GameButton";
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
import { AchievementChipList } from "./cards/AchievementChipList";
import {
  PlayerSpecialBadge,
  PlayerStatusBadge,
  resolvePlayerStatus,
} from "./cards/PlayerStatusBadge";
import { StatBox, TIER_STAT_SPAN_CLASS } from "./ui/StatBox";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SlotRecruitPlayerCardProps {
  player: Player;
  teamYearLabel: string;
  hardMode?: boolean;
  clubColorOverride?: string;
  statsExpanded?: boolean;
  topPick?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggleStats: () => void;
}

function ratingBadgeClass(rating: number): string {
  if (rating >= 85) {
    return "bg-accent-gold/15 text-accent-gold ring-accent-gold/40";
  }
  if (rating >= 78) {
    return "bg-theme-primary/15 text-theme-primary ring-theme-primary/40";
  }
  return "bg-pitch-800/90 text-pitch-100 ring-pitch-600/50";
}

/** Quick Mode pick card — sign or expand stats. */
export function SlotRecruitPlayerCard({
  player,
  teamYearLabel,
  hardMode,
  clubColorOverride,
  statsExpanded = false,
  topPick = false,
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
  const positionLabel = formatPlayerPositionLabel(player, { short: false });

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
        topPick ? "border-accent-gold/45 ring-1 ring-accent-gold/25" : "hover:border-accent-green/40"
      } ${disabled ? "opacity-50" : ""}`}
      style={{
        boxShadow: `inset 3px 0 0 ${colors.primary}`,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {topPick && (
              <span className="mb-1.5 inline-block rounded-md border border-accent-gold/40 bg-accent-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-gold">
                Top rating
              </span>
            )}
            <h3 className="line-clamp-2 break-words font-display text-sm font-bold leading-snug text-white sm:text-base">
              {displayName}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md border border-pitch-600/55 bg-pitch-950/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                {positionLabel}
              </span>
              {!hardMode && (
                <span className="rounded-md border border-pitch-600/55 bg-pitch-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                  {getNationalityAbbrev(player.nationality)}
                </span>
              )}
              {!hardMode && (
                <span className="rounded-md border border-pitch-600/55 bg-pitch-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                  {tier}
                </span>
              )}
            </div>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ${ratingBadgeClass(
              player.peakRating
            )}`}
          >
            <span className="font-display text-lg font-black leading-none">
              {hardMode ? "?" : player.peakRating}
            </span>
            {!hardMode && (
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider opacity-80">
                OVR
              </span>
            )}
          </div>
        </div>

        {!hardMode && (
          <p className={`mt-2 ${TYPO.bodySm} text-gray-500`}>
            Value {formatValue(player.value)} · Age {formatPlayerAge(player)}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-2 border-t border-pitch-700/45 px-3 py-3 sm:px-4">
        <GameButton
          variant="current"
          size="sm"
          fullWidth
          disabled={disabled}
          onClick={onSelect}
        >
          Sign player
        </GameButton>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={statsExpanded}
          onClick={onToggleStats}
          className="w-full rounded-lg border border-pitch-600/60 bg-pitch-950/50 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 transition hover:border-accent-green/35 hover:text-accent-green disabled:cursor-not-allowed sm:text-[11px]"
        >
          {statsExpanded ? "Hide stats" : "View full stats"}
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
            <div className="border-t border-pitch-700/50 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
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

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <StatBox
                  label="Position"
                  value={positionLabel}
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
