"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import type { Player } from "@/lib/types";
import {
  formatPlayerChoiceMetadata,
  formatPlayerChoiceName,
  getPlayerChoiceColorClub,
  getPlayerChoiceRating,
  getPrimaryPlayerChoiceTags,
  warnMissingPlayerChoiceData,
  type QuickPlayerChoiceTag,
} from "@/lib/game/quick-mode-player-choice";

export type QuickModePlayerChoiceCardProps = {
  player: Player;
  /** Optional A/B / Top rating / Boosted label above the name. */
  choiceLabel?: string;
  /** When false or hardMode, rating zone shows the hidden state. */
  ratingVisible?: boolean;
  hardMode?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Club colour / display override (slot team-year spins). */
  clubOverride?: string;
  clubColorOverride?: string;
  boosted?: boolean;
  topPick?: boolean;
  /** Easter-egg GOAT / Super Sam tags only when intended. */
  allowEasterEggTags?: boolean;
  selectLabel?: string;
  detailsLabel?: string;
  showDetailsAction?: boolean;
  onSelect: () => void;
  onViewDetails?: () => void;
  className?: string;
};

function ratingBadgeModifier(
  rating: number,
  hidden: boolean
): string {
  if (hidden) return "quick-player-card__rating-badge--hidden";
  if (rating >= 90) return "quick-player-card__rating-badge--gold";
  if (rating >= 84) return "quick-player-card__rating-badge--elite";
  return "";
}

function TagChip({ tag }: { tag: QuickPlayerChoiceTag }) {
  return (
    <span
      className={`quick-player-card__tag quick-player-card__tag--${tag.tone}`}
    >
      {tag.label}
    </span>
  );
}

/**
 * Shared Quick Mode player-selection card.
 * Fixed vertical zones — content volume must not shift siblings.
 */
export function QuickModePlayerChoiceCard({
  player,
  choiceLabel,
  ratingVisible = true,
  hardMode = false,
  selected = false,
  disabled = false,
  clubOverride,
  clubColorOverride,
  boosted = false,
  topPick = false,
  allowEasterEggTags = true,
  selectLabel = "Select Player",
  detailsLabel = "View Details",
  showDetailsAction = true,
  onSelect,
  onViewDetails,
  className = "",
}: QuickModePlayerChoiceCardProps) {
  const name = formatPlayerChoiceName(player);
  const metadata = formatPlayerChoiceMetadata(player, {
    clubOverride,
    hardMode,
  });
  const rating = getPlayerChoiceRating(player, {
    ratingVisible,
    hardMode,
  });
  const tags = hardMode
    ? []
    : getPrimaryPlayerChoiceTags(player, {
        boosted,
        topPick,
        allowEasterEggTags,
      });
  const colorClub = getPlayerChoiceColorClub(player, clubColorOverride);

  useEffect(() => {
    warnMissingPlayerChoiceData(player);
  }, [player]);

  return (
    <article
      className={`quick-player-card ${selected ? "quick-player-card--selected" : ""} ${
        topPick && !hardMode ? "quick-player-card--top-pick" : ""
      } ${disabled ? "quick-player-card--disabled" : ""} ${className}`.trim()}
      data-player-id={player.id}
      aria-label={`${name} player choice`}
    >
      <div className="quick-player-card__strip">
        <TeamColourStrip club={colorClub} />
      </div>

      <div className="quick-player-card__body">
        <div className="quick-player-card__choice-label" aria-hidden={!choiceLabel}>
          <span className="quick-player-card__choice-label-text">
            {choiceLabel ?? "\u00a0"}
          </span>
        </div>

        <header className="quick-player-card__identity">
          <h3 className="quick-player-card__name" title={name}>
            {name}
          </h3>
        </header>

        <div className="quick-player-card__metadata">
          <p className="quick-player-card__meta-line">{metadata.primaryLine}</p>
          <p className="quick-player-card__club" title={metadata.club}>
            {metadata.club}
          </p>
        </div>

        <div className="quick-player-card__rating">
          <div
            className={`quick-player-card__rating-badge ${ratingBadgeModifier(
              rating.value,
              rating.hidden
            )}`.trim()}
            aria-label={
              rating.hidden
                ? rating.hiddenLabel
                : `Overall rating ${rating.value}`
            }
          >
            <span className="quick-player-card__rating-value">
              {rating.hidden ? "?" : rating.display}
            </span>
            <span className="quick-player-card__rating-caption">
              {rating.hidden ? "Hidden" : "OVR"}
            </span>
          </div>
        </div>

        <div className="quick-player-card__tags" aria-label="Player tags">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>

        <div className="quick-player-card__details" aria-hidden />
      </div>

      <footer className="quick-player-card__actions">
        <GameButton
          variant="theme"
          size="sm"
          fullWidth
          disabled={disabled}
          onClick={onSelect}
        >
          {selectLabel}
        </GameButton>
        {showDetailsAction && onViewDetails ? (
          <button
            type="button"
            disabled={disabled}
            className="quick-player-card__details-btn"
            onClick={onViewDetails}
          >
            {detailsLabel}
          </button>
        ) : (
          /* Preserve action-zone height when details are unavailable (Hard Mode). */
          <span className="quick-player-card__details-btn invisible" aria-hidden>
            {detailsLabel}
          </span>
        )}
      </footer>
    </article>
  );
}

/** Parent grid class for equal-height Quick Mode choice layouts. */
export function quickPlayerChoiceGridClass(count: number): string {
  if (count <= 1) return "quick-player-choice-grid quick-player-choice-grid--one";
  if (count === 2) return "quick-player-choice-grid quick-player-choice-grid--two";
  return "quick-player-choice-grid quick-player-choice-grid--many";
}
