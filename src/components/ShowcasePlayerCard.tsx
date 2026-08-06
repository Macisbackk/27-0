"use client";

import { memo, useCallback, useMemo } from "react";
import type { Player } from "@/lib/types";
import {
  assertShowcaseCardPopupNameMatch,
  toPlayerShowcaseViewModel,
} from "@/lib/players/showcase-view-model";
import { getPlayerDisplayName } from "@/lib/players/display-name-resolver";
import { resolvePlayerCardColourContext } from "@/lib/players/player-card-colours";
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
 * Shared Player Showcase card — club kit owns border/strip; tier is badge-only.
 * Name geometry is identical for Current / Historic / Legend / Hall of Fame.
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const view = useMemo(() => toPlayerShowcaseViewModel(player), [player]);
  const colourCtx = useMemo(
    () => resolvePlayerCardColourContext(player, { maxTiers: 2 }),
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
    ? `${view.displayName}, ${view.clubYearLabel}`
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
        <span className="showcase-player-card__view">View Player</span>
      </button>
    </article>
  );
}, showcaseCardPropsEqual);
