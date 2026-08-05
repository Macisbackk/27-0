"use client";

import { memo, useCallback, useMemo, type CSSProperties } from "react";
import type { Player } from "@/lib/types";
import { getClubColoursForCard } from "@/lib/clubs";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { formatShowcaseClubYear } from "@/lib/players/year-card";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
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
 * Player Showcase row/card — club kit colours only for identity chrome.
 * Store UI theme must not paint borders/washes on these cards.
 * Player info opens in PlayerDetailModal rather than expanding inline.
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const displayName = formatPlayerDisplayName(player);
  const clubYearLabel = formatShowcaseClubYear(player);
  const colorClub = getPlayerColorClub(player);
  const isLegend = player.category === "legend";
  const cardColours = useMemo(
    () => getClubColoursForCard(colorClub),
    [colorClub]
  );

  const legendPanelStyle = useMemo(
    () =>
      ({
        borderColor: "rgba(251, 191, 36, 0.72)",
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,248,220,0.10) 40%, rgba(20,24,22,0.92) 100%)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.22) inset, 0 0 18px rgba(251,191,36,0.12)",
      }) as CSSProperties,
    []
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
      className={`showcase-player-card game-panel game-panel--flush h-auto w-full min-w-0 self-start overflow-hidden border transition hover:border-pitch-500/50 ${
        isLegend
          ? "border-accent-gold/70 ring-1 ring-accent-gold/45 hover:border-accent-gold/90"
          : ""
      }`}
      style={isLegend ? legendPanelStyle : cardColours.style}
    >
      <TeamColourStrip club={colorClub} />

      <button
        type="button"
        className={`flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03] sm:py-2.5 ${
          isLegend ? "hover:bg-accent-gold/5" : ""
        }`}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
      >
        <span className="showcase-compact-name min-w-0 flex-1 font-display font-bold leading-snug text-white">
          <span className="block break-words [overflow-wrap:anywhere] line-clamp-3">
            {displayName}
          </span>
          <span
            className={`mt-0.5 block truncate text-[11px] font-medium ${
              isLegend ? "text-accent-gold/85" : "text-gray-400"
            }`}
          >
            {clubYearLabel}
            {isLegend ? " · Legend" : ""}
          </span>
        </span>
        {isLegend && (
          <span className="shrink-0 self-start rounded border border-accent-gold/60 bg-gradient-to-br from-white/90 via-amber-50/90 to-accent-gold/35 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-900 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">
            Legend
          </span>
        )}
        <span className="shrink-0 self-start pt-0.5 text-xs font-medium text-gray-500">
          View
        </span>
      </button>
    </div>
  );
}, showcaseCardPropsEqual);
