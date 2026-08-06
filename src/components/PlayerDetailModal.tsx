"use client";

import { useEffect, useMemo } from "react";
import type { Player, Position } from "@/lib/types";
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
import { playPopupOpen } from "@/lib/sound";
import { AchievementChipList } from "./cards/AchievementChipList";
import { PlayerTierBadge } from "./cards/PlayerTierBadge";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { POSITION_LABELS } from "@/lib/positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
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
  const positionLabel =
    POSITION_LABELS[view.position as Position] ?? view.position;

  useEffect(() => {
    playPopupOpen();
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

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={displayName || `Name missing (${player.id})`}
      className="player-detail-sheet sm:max-w-lg"
      headerExtra={
        <div className="player-detail-sheet__intro mt-2">
          <p className="player-detail-modal__meta">
            {view.clubYearLabel}
            {view.nationality ? ` · ${view.nationality}` : ""}
            {positionLabel ? ` · ${positionLabel}` : ""}
          </p>
          <div className="mt-2">
            <PlayerTierBadge tiers={colourCtx.primaryTier} compact />
          </div>
        </div>
      }
    >
      <TeamColourStrip
        club={colourCtx.clubName}
        className="player-detail-sheet__strip mb-3"
      />

      <div className="player-detail-sheet__rating">
        <div className="player-detail-sheet__rating-main">
          <p className={TYPO.statLabel}>{ratingLabel}</p>
          <p className="player-detail-sheet__rating-value">{player.peakRating}</p>
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
        <div className="player-detail-sheet__rating-side">
          <p className={TYPO.statLabel}>Value</p>
          <p className="mt-0.5 font-semibold text-accent-gold">
            {formatValue(player.value)}
          </p>
        </div>
      </div>

      <div className={`mt-3 grid min-w-0 grid-cols-2 gap-2 ${TYPO.bodySm}`}>
        <InfoCell label="Age" value={formatPlayerAge(player)} />
        <InfoCell label="Position" value={positionLabel} />
        <InfoCell label="Years Active" value={player.yearsActive} wide />
      </div>

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
    </MobileBottomSheet>
  );
}

function InfoCell({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden ${CARD.inset} ${SPACING.cardPaddingSm} ${
        wide ? "col-span-2" : ""
      }`}
    >
      <p className={TYPO.statLabel}>{label}</p>
      <p className="mt-0.5 break-words font-medium text-white">{value}</p>
    </div>
  );
}
