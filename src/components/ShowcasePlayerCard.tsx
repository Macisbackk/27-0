"use client";

import { memo, useCallback, useMemo } from "react";
import type { Player, Position } from "@/lib/types";
import {
  assertShowcaseCardPopupNameMatch,
  toPlayerShowcaseViewModel,
} from "@/lib/players/showcase-view-model";
import { getPlayerDisplayName } from "@/lib/players/display-name-resolver";
import { resolvePlayerCardColourContext } from "@/lib/players/player-card-colours";
import { POSITION_LABELS } from "@/lib/positions";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { PlayerTierBadge } from "@/components/cards/PlayerTierBadge";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

interface ShowcasePlayerCardProps {
  player: Player;
  onOpenDetail: (playerId: string) => void;
}

function showcaseCardPropsEqual(
  prev: ShowcasePlayerCardProps,
  next: ShowcasePlayerCardProps
): boolean {
  return (
    prev.player.id === next.player.id &&
    prev.onOpenDetail === next.onOpenDetail
  );
}

/**
 * Shared Player Showcase card — club kit owns thin strip; tier is badge-only.
 * Name geometry is identical for Current / Historic / Legend / Hall of Fame.
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const view = useMemo(() => toPlayerShowcaseViewModel(player), [player]);
  const colourCtx = useMemo(
    () => resolvePlayerCardColourContext(player, { maxTiers: 1 }),
    [player]
  );

  const cardStyle = useMemo(
    () =>
      ({
        ...colourCtx.cardStyle,
        ["--player-card-border" as string]: colourCtx.clubBorder,
        ["--player-card-border-hover" as string]: colourCtx.clubBorder,
      }) as React.CSSProperties,
    [colourCtx]
  );

  const positionLabel =
    POSITION_LABELS[view.position as Position] ?? view.position;

  const handleOpen = useCallback(() => {
    playUiClick();
    const popupName = getPlayerDisplayName(player);
    assertShowcaseCardPopupNameMatch(
      view.playerId,
      view.displayName,
      popupName
    );
    onOpenDetail(view.playerId);
  }, [player, onOpenDetail, view.displayName, view.playerId]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  const ariaLabel = view.displayName
    ? `${view.displayName}, ${view.clubYearLabel}, rating ${view.rating}`
    : `Player ${view.playerId}, ${view.clubYearLabel}`;

  return (
    <article
      className="showcase-player-card game-panel game-panel--flush game-panel--player h-auto w-full min-w-0 self-start overflow-hidden border"
      style={cardStyle}
      data-player-id={view.playerId}
    >
      <TeamColourStrip
        club={colourCtx.clubName}
        className="showcase-player-card__strip"
      />

      <button
        type="button"
        className="showcase-player-card__body"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
      >
        <div className="showcase-player-card__header">
          <h3
            className={`showcase-player-card__name ${TYPO.cardTitle}`}
            title={view.displayName || undefined}
          >
            {view.displayName || (
              <span className="showcase-player-card__name-missing">
                Name missing ({view.playerId})
              </span>
            )}
          </h3>
          <PlayerTierBadge
            tiers={colourCtx.primaryTier}
            compact
            className="showcase-player-card__badge"
          />
        </div>

        <p className="showcase-player-card__meta" title={view.clubYearLabel}>
          {view.clubYearLabel}
        </p>

        <p className="showcase-player-card__facts">
          <span className="showcase-player-card__fact">
            <span className="showcase-player-card__fact-label">OVR</span>{" "}
            <span className="showcase-player-card__fact-value showcase-player-card__fact-value--rating">
              {view.rating}
            </span>
          </span>
          <span className="showcase-player-card__fact-sep" aria-hidden>
            ·
          </span>
          <span className="showcase-player-card__fact">{positionLabel}</span>
          {view.nationality ? (
            <>
              <span className="showcase-player-card__fact-sep" aria-hidden>
                ·
              </span>
              <span className="showcase-player-card__fact">{view.nationality}</span>
            </>
          ) : null}
        </p>
      </button>
    </article>
  );
}, showcaseCardPropsEqual);
