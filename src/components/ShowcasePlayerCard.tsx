"use client";

import { memo, useCallback, useMemo } from "react";
import type { Player } from "@/lib/types";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { formatShowcaseClubYear } from "@/lib/players/year-card";
import { resolvePlayerCardColourContext } from "@/lib/players/player-card-colours";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { PlayerTierBadge } from "@/components/cards/PlayerTierBadge";
import { playUiClick } from "@/lib/sound";

interface ShowcasePlayerCardProps {
  player: Player;
  onOpenDetail: (player: Player) => void;
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
 * Player Showcase row/card — club kit colours own the border and strip.
 * Tier is badge-only (never a competing outer ring/border).
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const displayName = formatPlayerDisplayName(player);
  const clubYearLabel = formatShowcaseClubYear(player);
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
    onOpenDetail(player);
  }, [player, onOpenDetail]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  return (
    <div
      className="showcase-player-card game-panel game-panel--flush h-auto w-full min-w-0 self-start overflow-hidden border transition"
      style={cardStyle}
    >
      <TeamColourStrip club={colourCtx.clubName} />

      <button
        type="button"
        className="showcase-player-card__body"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
      >
        <span className="showcase-compact-name min-w-0 flex-1 font-display font-bold leading-snug text-white">
          <span className="showcase-compact-name__title">
            {displayName}
          </span>
          <span className="mt-0.5 block w-full truncate text-[11px] font-medium text-gray-400">
            {clubYearLabel}
          </span>
        </span>
        <PlayerTierBadge
          tiers={colourCtx.primaryTier}
          compact
          className="shrink-0 self-start"
        />
        <span className="shrink-0 self-start pt-0.5 text-xs font-medium text-gray-500">
          View
        </span>
      </button>
    </div>
  );
}, showcaseCardPropsEqual);
