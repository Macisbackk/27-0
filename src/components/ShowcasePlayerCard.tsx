"use client";

import { memo, useCallback, useMemo } from "react";
import type { Player, Position } from "@/lib/types";
import {
  assertShowcaseCardPopupNameMatch,
  toPlayerShowcaseViewModel,
} from "@/lib/players/showcase-view-model";
import { resolvePlayerCardColourContext } from "@/lib/players/player-card-colours";
import { POSITION_LABELS } from "@/lib/positions";
import { ClubLogoBox } from "@/components/ClubBadge";
import { PlayerTierBadge } from "@/components/cards/PlayerTierBadge";
import { playUiClick } from "@/lib/sound";

interface ShowcasePlayerCardProps {
  player: Player;
  onOpenDetail: (playerId: string) => void;
}

function showcaseCardPropsEqual(prev: ShowcasePlayerCardProps, next: ShowcasePlayerCardProps): boolean {
  return prev.player.id === next.player.id && prev.player.peakRating === next.player.peakRating && prev.onOpenDetail === next.onOpenDetail;
}

/** Rating colour: gold for the very best, the theme accent for elite, white otherwise. */
export function showcaseRatingTone(rating: number): string {
  if (rating >= 95) return "showcase-rating--gold";
  if (rating >= 90) return "showcase-rating--accent";
  return "";
}

/**
 * Player Showcase row: rating tile, name (and season for era cards), club crest, club, position,
 * nationality, and a small tier tag. Same rounded tiles as the rest of the site.
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({ player, onOpenDetail }: ShowcasePlayerCardProps) {
  const view = useMemo(() => toPlayerShowcaseViewModel(player), [player]);
  const colourCtx = useMemo(() => resolvePlayerCardColourContext(player, { maxTiers: 1 }), [player]);
  const positionLabel = POSITION_LABELS[view.position as Position] ?? view.position;

  const handleOpen = useCallback(() => {
    playUiClick();
    assertShowcaseCardPopupNameMatch(view.playerId, view.displayName, toPlayerShowcaseViewModel(player).displayName);
    onOpenDetail(view.playerId);
  }, [player, onOpenDetail, view.displayName, view.playerId]);

  const ariaLabel = view.displayName
    ? `${view.title}, ${view.clubLabel}, ${positionLabel}, rating ${view.rating}`
    : `Player ${view.playerId}, ${view.clubYearLabel}`;

  return (
    <article className="showcase-row" data-player-id={view.playerId} style={{ ["--club" as string]: colourCtx.clubBorder }}>
      <button type="button" className="showcase-row__button" onClick={handleOpen} aria-haspopup="dialog" aria-label={ariaLabel}>
        <span className={`showcase-rating ${showcaseRatingTone(view.rating)}`} aria-hidden>
          <span className="showcase-rating__value">{view.rating}</span>
          <span className="showcase-rating__label">OVR</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="showcase-row__name" title={view.title || undefined}>
            {view.displayName || <span className="text-danger">Name missing ({view.playerId})</span>}
            {view.titleYear ? <span className="showcase-row__year"> ({view.titleYear})</span> : null}
          </span>
          <span className="showcase-row__meta">
            <ClubLogoBox club={colourCtx.clubName} size="xs" className="showcase-row__crest" />
            <span className="min-w-0 truncate">
              {view.clubLabel}
              <span className="showcase-row__dot"> · </span>
              {positionLabel}
              {view.nationality ? (
                <>
                  <span className="showcase-row__dot"> · </span>
                  {view.nationality}
                </>
              ) : null}
            </span>
          </span>
        </span>
        <PlayerTierBadge tiers={colourCtx.primaryTier} compact className="showcase-row__tier" />
      </button>
    </article>
  );
}, showcaseCardPropsEqual);
