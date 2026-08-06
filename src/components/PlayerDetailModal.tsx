"use client";

import { useEffect, useMemo } from "react";
import type { Player } from "@/lib/types";
import {
  formatPlayerAge,
  formatValue,
  getPlayerDisplayName,
} from "@/lib/players";
import { getGoldenBootYears } from "@/lib/players/achievements";
import { getCachedPlayerAchievements } from "@/lib/players/achievement-cache";
import {
  assertShowcaseCardPopupNameMatch,
  toPlayerShowcaseViewModel,
} from "@/lib/players/showcase-view-model";
import { playPanelClose, playPanelExpand } from "@/lib/sound";
import { AchievementChipList } from "./cards/AchievementChipList";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { PlayerTierBadge } from "./cards/PlayerTierBadge";
import { GameModal } from "@/components/ui/GameModal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { resolvePlayerCardColourContext } from "@/lib/players/player-card-colours";
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
  /** When opened from Showcase, pass the card's resolved name for equality assert. */
  cardDisplayName?: string;
}

export function PlayerDetailModal({
  player,
  onClose,
  ratingContext,
  seasonYear,
  cardDisplayName,
}: PlayerDetailModalProps) {
  const view = useMemo(() => toPlayerShowcaseViewModel(player), [player]);
  const displayName = view.displayName || getPlayerDisplayName(player);
  const colourCtx = useMemo(
    () => resolvePlayerCardColourContext(player, { maxTiers: 2 }),
    [player]
  );
  const achievements = getCachedPlayerAchievements(player, "expanded");
  const goldenBootYears = getGoldenBootYears(player.id);
  const resolvedRatingContext = getPlayerRatingContext(player, ratingContext);
  const resolvedSeasonYear = getPlayerSeasonRatingYear(player, seasonYear);
  const ratingLabel = getPlayerRatingLabel(resolvedRatingContext);

  useScrollLock(true, "player-detail-modal");

  useEffect(() => {
    playPanelExpand();
  }, []);

  useEffect(() => {
    if (cardDisplayName !== undefined) {
      assertShowcaseCardPopupNameMatch(
        player.id,
        cardDisplayName,
        displayName
      );
    }
  }, [cardDisplayName, displayName, player.id]);

  const handleClose = () => {
    playPanelClose();
    onClose();
  };

  return (
    <GameModal open onClose={handleClose} labelledBy="player-detail-title">
      <header className="player-detail-modal__header">
        <div className="min-w-0">
          <h2
            id="player-detail-title"
            className={`player-detail-modal__title ${TYPO.sectionTitle}`}
          >
            {displayName || `Name missing (${player.id})`}
          </h2>
          <p className="player-detail-modal__meta">
            {view.clubYearLabel}
            {view.nationality ? ` · ${view.nationality}` : ""}
          </p>
          <div className="mt-2">
            <PlayerTierBadge tiers={colourCtx.primaryTier} compact />
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className={`${BTN.closeSm} player-detail-modal__close`}
        >
          Close
        </button>
      </header>

      <RugbyLeaguePlayerCard
        player={player}
        variant="default"
        equalHeight
        achievementDisplay="expanded"
        allowLongName
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
        <div
          className={`mt-3 min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}
        >
          <p className={TYPO.statLabel}>Golden Boot</p>
          <p className={`mt-1 break-words ${TYPO.body}`}>
            {goldenBootYears.join(", ")}
          </p>
        </div>
      )}

      <div className={`mt-3 grid min-w-0 grid-cols-2 gap-2 ${TYPO.bodySm}`}>
        <div
          className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}
        >
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
        <div
          className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}
        >
          <p className={TYPO.statLabel}>Value</p>
          <p className="mt-0.5 font-semibold text-accent-gold">
            {formatValue(player.value)}
          </p>
        </div>
        <div
          className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm}`}
        >
          <p className={TYPO.statLabel}>Age</p>
          <p className="mt-0.5 font-medium text-white">
            {formatPlayerAge(player)}
          </p>
        </div>
        <div
          className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm} col-span-2`}
        >
          <p className={TYPO.statLabel}>Years Active</p>
          <p className="mt-0.5 break-words font-medium text-white">
            {player.yearsActive}
          </p>
        </div>
      </div>
    </GameModal>
  );
}
