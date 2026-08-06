"use client";

import { useEffect } from "react";
import type { Player } from "@/lib/types";
import {
  formatPlayerDisplayName,
  formatPlayerAge,
  formatValue,
} from "@/lib/players";
import { getGoldenBootYears } from "@/lib/players/achievements";
import { getCachedPlayerAchievements } from "@/lib/players/achievement-cache";
import { playPanelClose, playPanelExpand } from "@/lib/sound";
import { AchievementChipList } from "./cards/AchievementChipList";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { GameModal } from "@/components/ui/GameModal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  getCurrentRatingSupportText,
  getCurrentSeasonYearNumber,
  getPlayerRatingContext,
  getPlayerRatingLabel,
  getPlayerSeasonRatingYear,
  getSeasonRatingSupportText,
  type PlayerRatingContext,
} from "@/lib/players/rating-context";

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  ratingContext?: PlayerRatingContext;
  seasonYear?: number;
}

export function PlayerDetailModal({
  player,
  onClose,
  ratingContext,
  seasonYear,
}: PlayerDetailModalProps) {
  const achievements = getCachedPlayerAchievements(player, "expanded");
  const goldenBootYears = getGoldenBootYears(player.id);
  const resolvedRatingContext = getPlayerRatingContext(player, ratingContext);
  const resolvedSeasonYear = getPlayerSeasonRatingYear(player, seasonYear);
  const ratingLabel = getPlayerRatingLabel(resolvedRatingContext);

  useScrollLock(true, "player-detail-modal");

  useEffect(() => {
    playPanelExpand();
  }, []);

  const handleClose = () => {
    playPanelClose();
    onClose();
  };

  return (
    <GameModal open onClose={handleClose} labelledBy="player-detail-title">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p id="player-detail-title" className={TYPO.sectionLabel}>
          Player Details
        </p>
        <button type="button" onClick={handleClose} className={BTN.closeSm}>
          Close
        </button>
      </div>

      <RugbyLeaguePlayerCard
        player={player}
        variant="default"
        equalHeight
        achievementDisplay="expanded"
      />

      {achievements.length > 0 && (
        <div className={`mt-4 min-w-0 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={`${TYPO.sectionTitle} mb-2`}>Achievements</p>
          <AchievementChipList
            achievements={achievements}
            dreamTeamDefaultExpanded
          />
        </div>
      )}

      {goldenBootYears.length > 0 && (
        <div className={`mt-3 min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.statLabel}>Golden Boot</p>
          <p className={`mt-1 break-words ${TYPO.body}`}>{goldenBootYears.join(", ")}</p>
        </div>
      )}

      <div className={`mt-3 grid min-w-0 grid-cols-2 gap-2 ${TYPO.bodySm}`}>
        <div className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.statLabel}>{ratingLabel}</p>
          <p className="mt-0.5 font-semibold text-[color:var(--rating)]">
            {player.peakRating}
          </p>
          {(resolvedRatingContext === "season" ||
            resolvedRatingContext === "current") && (
              <p className="mt-1 break-words text-[11px] leading-snug text-pitch-400">
                {resolvedRatingContext === "current"
                  ? getCurrentRatingSupportText(
                      resolvedSeasonYear ?? getCurrentSeasonYearNumber()
                    )
                  : resolvedSeasonYear !== undefined
                    ? getSeasonRatingSupportText(resolvedSeasonYear)
                    : null}
              </p>
            )}
        </div>
        <div className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.statLabel}>Value</p>
          <p className="mt-0.5 font-semibold text-accent-gold">
            {formatValue(player.value)}
          </p>
        </div>
        <div className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={TYPO.statLabel}>Age</p>
          <p className="mt-0.5 font-medium text-white">
            {formatPlayerAge(player)}
          </p>
        </div>
        <div className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm} col-span-2`}>
          <p className={TYPO.statLabel}>Years Active</p>
          <p className="mt-0.5 break-words font-medium text-white">{player.yearsActive}</p>
        </div>
        <div className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm} col-span-2`}>
          <p className={TYPO.statLabel}>Player</p>
          <p className="mt-0.5 break-words font-medium text-white">
            {formatPlayerDisplayName(player)}
          </p>
        </div>
      </div>
    </GameModal>
  );
}
