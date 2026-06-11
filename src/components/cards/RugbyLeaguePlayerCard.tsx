"use client";

import { memo, useMemo } from "react";
import type { Player } from "@/lib/types";
import { formatCareerTries, formatValue } from "@/lib/players";
import { getPlayerInitials } from "@/lib/players/initials";
import { getValueTier } from "@/lib/players/ratings";
import {
  getPlayerAchievements,
  type AchievementDisplayMode,
} from "@/lib/players/achievements";
import { AchievementChipList } from "./AchievementChipList";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";
import { getClubColors } from "@/lib/clubs";
import { POSITION_TILE_LABEL } from "@/lib/positions";
import {
  ClubColourBar,
  ClubHeaderBar,
  ClubNameStrip,
} from "../ClubBadge";
import { PlayerIdentityLine } from "../PlayerIdentityLine";
import { TYPO } from "@/lib/ui/typography";
import { StatBox, TIER_STAT_SPAN_CLASS } from "../ui/StatBox";
import {
  RLCardShell,
  RLInfoBox,
  RLRatingDisplay,
} from "./rl-card";
import {
  PlayerSpecialBadge,
  PlayerStatusBadge,
  resolvePlayerStatus,
} from "./PlayerStatusBadge";

export type RLPlayerCardVariant = "recruitment" | "pitch" | "default";

interface RugbyLeaguePlayerCardProps {
  player: Player;
  variant?: RLPlayerCardVariant;
  hardMode?: boolean;
  compact?: boolean;
  equalHeight?: boolean;
  compactMobile?: boolean;
  achievementDisplay?: AchievementDisplayMode;
  className?: string;
}

const PITCH_SIZE =
  "w-[88px] min-h-[96px] sm:w-[92px] sm:min-h-[100px] md:w-[96px] md:min-h-[104px]";

export const RugbyLeaguePlayerCard = memo(function RugbyLeaguePlayerCard({
  player,
  variant = "default",
  hardMode,
  compact,
  equalHeight,
  compactMobile,
  achievementDisplay = "compact",
  className = "",
}: RugbyLeaguePlayerCardProps) {
  const colors = getClubColors(player.club);
  const isLegend = player.category === "legend";
  const isGoat = isGoatPlayer(player);
  const isSuperSam = isSuperSamHallasPlayer(player);
  const playerStatus = resolvePlayerStatus(player);
  const achievements = useMemo(
    () => getPlayerAchievements(player, achievementDisplay),
    [player, achievementDisplay]
  );
  const tier = getValueTier(player.peakRating);
  const isRecruitment = variant === "recruitment";
  const isPitch = variant === "pitch";
  const maskValue = (value: string) => (hardMode ? "???" : value);
  const hiddenClass = hardMode ? "invisible select-none" : "";

  const appearancesValue =
    player.appearances !== undefined
      ? String(player.appearances)
      : "Unknown";

  const statusStrip =
    isSuperSam ? (
      <PlayerSpecialBadge
        variant="superSam"
        compact={compactMobile}
        className={hiddenClass}
      />
    ) : isGoat ? (
      <PlayerSpecialBadge
        variant="goat"
        compact={compactMobile}
        className={hiddenClass}
      />
    ) : playerStatus ? (
      <PlayerStatusBadge
        status={playerStatus}
        compact={compactMobile}
        className={hiddenClass}
      />
    ) : null;

  const achievementBadges =
    achievements.length > 0 ? (
      <AchievementChipList
        achievements={achievements}
        compactMobile={compactMobile}
        dreamTeamDefaultExpanded={achievementDisplay === "expanded"}
        className={hiddenClass}
      />
    ) : null;

  if (isPitch) {
    const initials = getPlayerInitials(player.name);
    const positionLabel = POSITION_TILE_LABEL[player.position];
    return (
      <RLCardShell
        club={player.club}
        className={`shrink-0 ${PITCH_SIZE} ${className}`}
      >
        {isSuperSam && (
          <div
            className={`flex justify-center border-b border-pitch-600/40 bg-pitch-950/90 px-1 py-px ${hiddenClass}`}
            aria-hidden={hardMode || undefined}
          >
            <PlayerSpecialBadge variant="superSam" compact />
          </div>
        )}
        {isGoat && !isSuperSam && (
          <div
            className={`flex justify-center border-b border-pitch-600/40 bg-pitch-950/90 px-1 py-px ${hiddenClass}`}
            aria-hidden={hardMode || undefined}
          >
            <PlayerSpecialBadge variant="goat" compact />
          </div>
        )}
        <ClubHeaderBar club={player.club} size="pitch" thick />
        <div
          className={`flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-1.5 sm:px-1.5 sm:py-2 ${
            compact ? "gap-0.5" : "gap-1"
          }`}
        >
          <span
            className={`pitch-card-initials font-display font-black uppercase leading-none tracking-wider text-accent-green ${
              compact
                ? "text-xs sm:text-sm"
                : "text-sm sm:text-base"
            }`}
          >
            {initials}
          </span>
          <span
            className={`pitch-card-position w-full text-center font-display font-bold uppercase leading-tight tracking-wide text-gray-300 ${
              compact
                ? "text-[6px] sm:text-[7px]"
                : "text-[7px] sm:text-[8px]"
            }`}
          >
            {positionLabel}
          </span>
          <p
            className={`pitch-card-name w-full truncate text-center font-display font-bold leading-tight text-white ${
              compact
                ? "text-[8px] sm:text-[9px]"
                : "text-[9px] sm:text-[10px]"
            }`}
          >
            {player.name}
          </p>
          <span
            className={`pitch-card-rating font-display font-bold leading-none text-accent-green ${
              compact
                ? "text-sm sm:text-base"
                : "text-base sm:text-[17px]"
            } ${hardMode ? "text-gray-600" : ""}`}
          >
            {hardMode ? "???" : player.peakRating}
          </span>
        </div>
      </RLCardShell>
    );
  }

  if (isRecruitment) {
    const mobileCompact = compactMobile;

    return (
      <RLCardShell
        club={player.club}
        className={`${equalHeight ? "min-h-full" : ""} ${className}`}
      >
        <div
          className={`flex items-start gap-1.5 px-2 pb-1 pt-2 sm:gap-3 sm:px-5 sm:pb-2 sm:pt-5 ${
            mobileCompact ? "gap-1" : ""
          }`}
        >
          <div className="min-w-0 flex-1 pr-1">
            <h2
              className={`truncate ${
                mobileCompact
                  ? "text-xs font-bold leading-tight sm:text-base"
                  : TYPO.playerName
              }`}
            >
              {player.name}
            </h2>
            {statusStrip}
            <PlayerIdentityLine
              player={player}
              compact={mobileCompact}
              className={statusStrip ? "!mt-0" : undefined}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <RLRatingDisplay
              rating={player.peakRating}
              large
              compact={mobileCompact}
              masked={hardMode}
            />
          </div>
        </div>

        <ClubColourBar club={player.club} />
        <ClubNameStrip
          club={player.club}
          colors={colors}
          compact={mobileCompact}
        />

        <div
          className={`flex flex-1 flex-col px-2 pb-2 sm:gap-3 sm:px-5 sm:pb-5 ${
            mobileCompact ? "gap-1" : "gap-2.5"
          }`}
        >
          {achievementBadges && (
            <div className={`${mobileCompact ? "hidden sm:block" : ""} pt-0.5`}>
              {achievementBadges}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
            <StatBox
              label="Apps"
              value={appearancesValue}
              size="lg"
              light
              compact={mobileCompact}
            />
            <StatBox
              label="Tries"
              value={formatCareerTries(player.tries)}
              size="lg"
              light
              compact={mobileCompact}
            />
            <StatBox
              label="Years"
              value={player.yearsActive}
              size="lg"
              light
              compact={mobileCompact}
              className="hidden sm:block"
            />
            <StatBox
              label="Value"
              value={maskValue(formatValue(player.value))}
              size="lg"
              light
              compact={mobileCompact}
            />
            <StatBox
              label="Tier"
              value={maskValue(tier)}
              size="lg"
              light
              compact={mobileCompact}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>
      </RLCardShell>
    );
  }

  return (
    <RLCardShell
      club={player.club}
      className={`${equalHeight ? "min-h-full" : ""} ${
        isGoat ? "ring-2 ring-accent-gold" : isLegend ? "ring-2 ring-accent-gold/40" : ""
      } ${className}`}
    >
      <ClubColourBar club={player.club} />
      <ClubNameStrip club={player.club} colors={colors} />

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 pr-1">
            <h2 className={`truncate ${TYPO.playerNameSm}`}>{player.name}</h2>
            {statusStrip}
            <PlayerIdentityLine
              player={player}
              className={statusStrip ? "!mt-0" : undefined}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <RLRatingDisplay rating={player.peakRating} masked={hardMode} />
          </div>
        </div>

        {achievementBadges}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBox label="Apps" value={appearancesValue} />
          <StatBox label="Tries" value={formatCareerTries(player.tries)} />
          <StatBox
            label="Years"
            value={player.yearsActive}
            className="hidden sm:block"
          />
          <StatBox
            label="Value"
            value={maskValue(formatValue(player.value))}
          />
          <StatBox
            label="Tier"
            value={maskValue(tier)}
            light
            className={TIER_STAT_SPAN_CLASS}
          />
        </div>
      </div>
    </RLCardShell>
  );
});

export const PITCH_CARD_SIZE_CLASS = PITCH_SIZE;
