"use client";

import { memo, useMemo } from "react";
import type { Player } from "@/lib/types";
import {
  formatCareerTries,
  formatPlayerDisplayName,
  formatPlayerAge,
  formatValue,
} from "@/lib/players";
import { getPlayerInitials } from "@/lib/players/initials";
import { getValueTier } from "@/lib/players/ratings";
import type { AchievementDisplayMode } from "@/lib/players/achievements";
import { getCachedPlayerAchievements } from "@/lib/players/achievement-cache";
import { AchievementChipList } from "./AchievementChipList";
import { isGoatPlayer } from "@/lib/players/goat";
import { isSuperSamHallasPlayer } from "@/lib/players/super-sam-hallas";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub, getPlayerDisplayClub } from "@/lib/players/run-club";
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
  /** Showcase expanded cards — wrap long names instead of truncating. */
  allowLongName?: boolean;
  /** Era mode: use era team club colours instead of the player's current club. */
  clubColorOverride?: string;
  /** Hide the top colour bar when a parent shell already shows club colours. */
  showClubColourBar?: boolean;
  className?: string;
}

const PITCH_SIZE =
  "w-[88px] min-h-[96px] sm:w-[92px] sm:min-h-[100px] md:w-[96px] md:min-h-[104px]";

function playerCardPropsEqual(
  prev: RugbyLeaguePlayerCardProps,
  next: RugbyLeaguePlayerCardProps
): boolean {
  return (
    prev.player.id === next.player.id &&
    prev.variant === next.variant &&
    prev.hardMode === next.hardMode &&
    prev.compact === next.compact &&
    prev.equalHeight === next.equalHeight &&
    prev.compactMobile === next.compactMobile &&
    prev.achievementDisplay === next.achievementDisplay &&
    prev.allowLongName === next.allowLongName &&
    prev.clubColorOverride === next.clubColorOverride &&
    prev.showClubColourBar === next.showClubColourBar &&
    prev.className === next.className
  );
}

export const RugbyLeaguePlayerCard = memo(function RugbyLeaguePlayerCard({
  player,
  variant = "default",
  hardMode,
  compact,
  equalHeight,
  compactMobile,
  achievementDisplay = "compact",
  allowLongName = false,
  clubColorOverride,
  showClubColourBar = true,
  className = "",
}: RugbyLeaguePlayerCardProps) {
  const displayClub = getPlayerDisplayClub(player);
  const colorClub = getPlayerColorClub(player, clubColorOverride);
  const colors = getClubColors(colorClub);
  const isLegend = player.category === "legend";
  const isGoat = isGoatPlayer(player);
  const isSuperSam = isSuperSamHallasPlayer(player);
  const playerStatus = resolvePlayerStatus(player);
  const achievements = useMemo(
    () => getCachedPlayerAchievements(player, achievementDisplay),
    [player.id, achievementDisplay]
  );
  const tier = getValueTier(player.peakRating);
  const displayName = formatPlayerDisplayName(player);
  const isRecruitment = variant === "recruitment";
  const isPitch = variant === "pitch";
  const maskValue = (value: string) => (hardMode ? "???" : value);
  const hiddenClass = hardMode ? "invisible select-none" : "";

  const appearancesValue =
    player.appearances !== undefined
      ? String(player.appearances)
      : "Unknown";
  const ageValue = formatPlayerAge(player);

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
        club={colorClub}
        clubColorOverride={clubColorOverride}
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
        <ClubHeaderBar club={colorClub} size="pitch" thick />
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
          <p className="w-full line-clamp-2 break-words text-center font-display text-[6px] font-semibold leading-tight text-white sm:text-[7px]">
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
        club={colorClub}
        clubColorOverride={clubColorOverride}
        className={`${equalHeight ? "min-h-full" : ""} ${className}`}
      >
        <div
          className={`flex items-start gap-1 px-1.5 pb-1 pt-1.5 sm:gap-2 sm:px-3 sm:pb-1.5 sm:pt-3 ${
            mobileCompact ? "gap-0.5" : ""
          }`}
        >
          <div className="min-w-0 flex-1 overflow-hidden pr-1">
            <h2
              className={`truncate ${
                mobileCompact
                  ? "text-xs font-bold leading-tight sm:text-base"
                  : TYPO.playerName
              }`}
            >
              {displayName}
            </h2>
            {statusStrip && (
              <div className="max-w-full min-w-0 overflow-hidden">{statusStrip}</div>
            )}
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

        {showClubColourBar && <ClubColourBar club={colorClub} />}
        <ClubNameStrip
          club={displayClub}
          colors={colors}
          compact={mobileCompact}
        />

        <div
          className={`flex flex-1 flex-col px-1.5 pb-1.5 sm:gap-2 sm:px-3 sm:pb-3 ${
            mobileCompact ? "gap-0.5" : "gap-2"
          }`}
        >
          {achievementBadges && (
            <div className={`${mobileCompact ? "hidden sm:block" : ""} pt-0`}>
              {achievementBadges}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5">
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
              label="Age"
              value={ageValue}
              size="lg"
              light
              compact={mobileCompact}
            />
            <StatBox
              label="Years Active"
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

  const allowAchievementPopover =
    achievementDisplay === "showcase" || achievementDisplay === "expanded";
  const showcaseTopBarOnly = achievementDisplay === "showcase";

  return (
    <RLCardShell
      club={colorClub}
      clubColorOverride={clubColorOverride}
      clubAccent={showcaseTopBarOnly ? "top-bar-only" : "full"}
      className={`${equalHeight ? "min-h-full" : ""} ${
        isGoat ? "ring-2 ring-accent-gold" : isLegend ? "ring-2 ring-accent-gold/40" : ""
      } ${allowAchievementPopover ? "!overflow-visible" : ""} ${className}`}
    >
      {showClubColourBar && <ClubColourBar club={colorClub} />}
      {!showcaseTopBarOnly && (
        <ClubNameStrip club={displayClub} colors={colors} />
      )}

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 overflow-hidden pr-1">
            <h2
              className={`${
                allowLongName
                  ? "break-words [overflow-wrap:anywhere] leading-snug line-clamp-3"
                  : "truncate"
              } ${TYPO.playerNameSm}`}
            >
              {displayName}
            </h2>
            {statusStrip && (
              <div className="max-w-full min-w-0 overflow-hidden">{statusStrip}</div>
            )}
            <PlayerIdentityLine
              player={player}
              className={statusStrip ? "!mt-0" : undefined}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <RLRatingDisplay rating={player.peakRating} masked={hardMode} />
          </div>
        </div>

        {achievementBadges && (
          <div className="relative z-20 overflow-visible">{achievementBadges}</div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBox label="Apps" value={appearancesValue} />
          <StatBox label="Tries" value={formatCareerTries(player.tries)} />
          <StatBox label="Age" value={ageValue} />
          <StatBox
            label="Years Active"
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
}, playerCardPropsEqual);

export const PITCH_CARD_SIZE_CLASS = PITCH_SIZE;
