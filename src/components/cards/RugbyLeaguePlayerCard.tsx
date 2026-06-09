"use client";

import type { Player } from "@/lib/types";
import { formatCareerTries, formatValue } from "@/lib/players";
import { getPlayerInitials } from "@/lib/players/initials";
import { getValueTier } from "@/lib/players/ratings";
import { isActivePlayer } from "@/lib/players/active";
import { getPlayerAchievements } from "@/lib/players/achievements";
import { isGoatPlayer } from "@/lib/players/goat";
import { getClubColors } from "@/lib/clubs";
import { POSITION_TILE_LABEL } from "@/lib/positions";
import {
  ClubColourBar,
  ClubHeaderBar,
  ClubNameStrip,
} from "../ClubBadge";
import { PlayerIdentityLine } from "../PlayerIdentityLine";
import { TYPO } from "@/lib/ui/typography";
import {
  ACHIEVEMENT_BADGE_CLASSES,
  RLCardShell,
  RLInfoBox,
  RLRatingDisplay,
  RLStatBox,
} from "./rl-card";

export type RLPlayerCardVariant = "recruitment" | "pitch" | "default";

interface RugbyLeaguePlayerCardProps {
  player: Player;
  variant?: RLPlayerCardVariant;
  hardMode?: boolean;
  compact?: boolean;
  equalHeight?: boolean;
  className?: string;
}

const PITCH_SIZE =
  "w-[88px] min-h-[96px] sm:w-[92px] sm:min-h-[100px] md:w-[96px] md:min-h-[104px]";

export function RugbyLeaguePlayerCard({
  player,
  variant = "default",
  hardMode,
  compact,
  equalHeight,
  className = "",
}: RugbyLeaguePlayerCardProps) {
  const colors = getClubColors(player.club);
  const isLegend = player.category === "legend";
  const isHistoric = player.category === "historic" || isLegend;
  const isGoat = isGoatPlayer(player);
  const isActive = isActivePlayer(player);
  const achievements = getPlayerAchievements(player);
  const tier = getValueTier(player.peakRating);
  const isRecruitment = variant === "recruitment";
  const isPitch = variant === "pitch";
  const hiddenClass = hardMode ? "invisible select-none" : "";

  const appearancesValue = isActive
    ? "Still Playing"
    : player.appearances !== undefined
      ? String(player.appearances)
      : "—";

  const showCategoryBadge =
    isGoat || isLegend || (isHistoric && !isLegend && !isGoat);

  const categoryBadge = showCategoryBadge ? (
    <div
      className={`shrink-0 px-2 py-0.5 text-center font-medium uppercase tracking-widest ${
        isRecruitment ? "text-[9px]" : "text-[8px]"
      } ${
        isGoat
          ? "bg-accent-gold text-pitch-950"
          : isLegend
            ? "bg-accent-gold/15 text-accent-gold"
            : "bg-purple-500/10 text-purple-300"
      } ${hiddenClass}`}
      aria-hidden={hardMode || undefined}
    >
      {isGoat ? "GOAT" : isLegend ? "Legend" : "Historic"}
    </div>
  ) : null;

  const achievementBadges =
    achievements.length > 0 ? (
      <RLInfoBox className="px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {achievements.map((achievement) => (
            <span
              key={achievement.label}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-snug ${
                ACHIEVEMENT_BADGE_CLASSES[achievement.color]
              }`}
            >
              {achievement.label}
            </span>
          ))}
        </div>
      </RLInfoBox>
    ) : null;

  if (isPitch) {
    const initials = getPlayerInitials(player.name);
    const positionLabel = POSITION_TILE_LABEL[player.position];
    return (
      <RLCardShell
        club={player.club}
        className={`shrink-0 ${PITCH_SIZE} ${className}`}
      >
        {isGoat && (
          <div
            className={`shrink-0 bg-accent-gold py-px text-center text-[5px] font-black uppercase text-pitch-950 ${hiddenClass}`}
            aria-hidden={hardMode || undefined}
          >
            GOAT
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
            } ${hiddenClass}`}
            aria-hidden={hardMode || undefined}
          >
            {player.peakRating}
          </span>
        </div>
      </RLCardShell>
    );
  }

  if (isRecruitment) {
    return (
      <RLCardShell
        club={player.club}
        className={`${equalHeight ? "min-h-full" : ""} ${className}`}
      >
        {categoryBadge}

        <div className="flex items-start gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate ${TYPO.playerName}`}>{player.name}</h2>
            <PlayerIdentityLine player={player} />
          </div>
          <RLRatingDisplay
            rating={player.peakRating}
            large
            className={hiddenClass}
          />
        </div>

        <ClubColourBar club={player.club} />
        <ClubNameStrip club={player.club} colors={colors} />

        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 sm:gap-3 sm:px-5 sm:pb-5">
          {achievementBadges}

          <div className="grid grid-cols-3 gap-2">
            <RLStatBox label="Apps" value={appearancesValue} large light />
            <RLStatBox label="Tries" value={formatCareerTries(player.tries)} large light />
            <RLStatBox label="Years" value={player.yearsActive} large light />
            <RLStatBox
              label="Value"
              value={formatValue(player.value)}
              large
              light
              className={hiddenClass}
            />
            <RLStatBox
              label="Tier"
              value={tier}
              large
              light
              className={hiddenClass}
            />
            <RLStatBox
              label="Intl Caps"
              value={player.intlCaps > 0 ? String(player.intlCaps) : "—"}
              large
              light
              className={hiddenClass}
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
      {categoryBadge}

      <ClubColourBar club={player.club} />
      <ClubNameStrip club={player.club} colors={colors} />

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate ${TYPO.playerNameSm}`}>{player.name}</h2>
            <PlayerIdentityLine player={player} />
          </div>
          <RLRatingDisplay
            rating={player.peakRating}
            className={hiddenClass}
          />
        </div>

        {achievementBadges}

        <div className="grid grid-cols-3 gap-2">
          <RLStatBox label="Apps" value={appearancesValue} />
          <RLStatBox label="Tries" value={formatCareerTries(player.tries)} />
          <RLStatBox label="Years" value={player.yearsActive} />
          <RLStatBox
            label="Value"
            value={formatValue(player.value)}
            className={hiddenClass}
          />
          <RLStatBox
            label="Tier"
            value={tier}
            className={hiddenClass}
          />
          <RLStatBox
            label="Intl Caps"
            value={player.intlCaps > 0 ? String(player.intlCaps) : "—"}
            className={hiddenClass}
          />
        </div>
      </div>
    </RLCardShell>
  );
}

export const PITCH_CARD_SIZE_CLASS = PITCH_SIZE;
