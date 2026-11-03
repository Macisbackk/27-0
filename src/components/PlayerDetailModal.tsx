"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player, Position } from "@/lib/types";
import {
  formatPlayerAge,
  formatValue,
  getPlayerById,
  getPlayerDisplayName,
} from "@/lib/players";
import {
  assertShowcaseCardPopupNameMatch,
  toPlayerShowcaseViewModel,
} from "@/lib/players/showcase-view-model";
import { playPopupOpen } from "@/lib/sound";
import { PlayerTierBadge } from "./cards/PlayerTierBadge";
import { PlayerProfileSections } from "./PlayerProfileSections";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { POSITION_LABELS } from "@/lib/positions";
import { cardRarity, RARITY_COLOUR, RARITY_LABEL } from "@/lib/card-rarity";
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

/**
 * The player card sheet (Showcase + Squad Book). Header: name, club · year · position, tier badge;
 * then a hero row (rating in a rarity-edged badge, value) and the profile sections.
 */
export function PlayerDetailModal({
  player: openedPlayer,
  onClose,
  ratingContext,
  seasonYear,
  cardDisplayName,
}: PlayerDetailModalProps) {
  // The card list in the profile can switch the sheet to another of his cards.
  const [activeId, setActiveId] = useState(openedPlayer.id);
  useEffect(() => setActiveId(openedPlayer.id), [openedPlayer.id]);
  const switched = activeId !== openedPlayer.id;
  const player = (switched ? getPlayerById(activeId) : undefined) ?? openedPlayer;
  const view = useMemo(() => toPlayerShowcaseViewModel(player), [player]);
  const displayName = view.displayName || getPlayerDisplayName(player);
  const colourCtx = useMemo(
    () => resolvePlayerCardColourContext(player, { maxTiers: 2 }),
    [player]
  );
  const resolvedRatingContext = getPlayerRatingContext(player, switched ? undefined : ratingContext);
  const resolvedSeasonYear = getPlayerSeasonRatingYear(player, switched ? undefined : seasonYear);
  const ratingLabel = getPlayerRatingLabel(resolvedRatingContext);
  const positionLabel =
    POSITION_LABELS[view.position as Position] ?? view.position;
  const rarity = cardRarity(player);
  const rarityColour = RARITY_COLOUR[rarity];
  const supportText =
    resolvedRatingContext === "current"
      ? getCurrentRatingSupportText(resolvedSeasonYear ?? getCurrentSeasonYearNumber())
      : resolvedRatingContext === "season" && resolvedSeasonYear !== undefined
        ? getSeasonRatingSupportText(resolvedSeasonYear)
        : null;
  const meta = [view.clubLabel, positionLabel, view.nationality].filter(Boolean).join(" · ");

  useEffect(() => {
    playPopupOpen();
  }, []);

  useEffect(() => {
    if (cardDisplayName !== undefined && !switched) {
      assertShowcaseCardPopupNameMatch(
        player.id,
        cardDisplayName,
        displayName
      );
    }
  }, [cardDisplayName, displayName, player.id, switched]);

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={(displayName && view.title) || displayName || `Name missing (${player.id})`}
      className="player-detail-sheet sm:max-w-lg"
      headerExtra={
        <div className="player-detail-sheet__intro mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="player-detail-modal__meta min-w-0">{meta}</p>
          <PlayerTierBadge tiers={colourCtx.primaryTier} compact max={1} />
        </div>
      }
    >
      <TeamColourStrip
        club={colourCtx.clubName}
        className="player-detail-sheet__strip mb-4"
      />

      {/* Hero: rating in a rarity-edged badge, value on the right. */}
      <div className="player-profile-hero flex min-w-0 items-center gap-3" data-testid="player-hero">
        <div
          className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 bg-pitch-950/60"
          style={{
            borderColor: rarityColour,
            boxShadow: rarity === "legendary" ? `0 0 14px ${rarityColour}55` : undefined,
          }}
          data-rarity={rarity}
        >
          <span className="font-display text-[30px] font-extrabold leading-none tabular-nums text-white">
            {player.peakRating}
          </span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: rarityColour }}>
            {RARITY_LABEL[rarity]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--fl-muted)]">{ratingLabel}</p>
          {supportText ? (
            <p className="mt-0.5 break-words text-xs leading-snug text-[color:var(--fl-muted)]">{supportText}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--fl-muted)]">Value</p>
          <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-accent-gold">{formatValue(player.value)}</p>
        </div>
      </div>

      <PlayerProfileSections
        player={player}
        activeCardId={player.id}
        onSelectCard={setActiveId}
        facts={[
          { label: "Age", value: formatPlayerAge(player) },
          { label: "Active", value: player.yearsActive },
        ]}
      />
    </MobileBottomSheet>
  );
}
