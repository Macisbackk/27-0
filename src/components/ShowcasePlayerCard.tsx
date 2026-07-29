"use client";

import { memo, useCallback, useMemo } from "react";
import type { Player } from "@/lib/types";
import { getPlayerCardColours } from "@/lib/clubs";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { formatShowcaseClubYear } from "@/lib/players/year-card";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { GameButton } from "@/components/ui/GameButton";
import { playPanelClose, playPanelExpand } from "@/lib/sound";

interface ShowcasePlayerCardProps {
  player: Player;
  expanded: boolean;
  onToggle: (player: Player) => void;
  onOpenDetail: (player: Player) => void;
}

function showcaseCardPropsEqual(
  prev: ShowcasePlayerCardProps,
  next: ShowcasePlayerCardProps
): boolean {
  return (
    prev.player.id === next.player.id &&
    prev.expanded === next.expanded &&
    prev.onToggle === next.onToggle &&
    prev.onOpenDetail === next.onOpenDetail
  );
}

/**
 * Player Showcase row/card — club kit colours only for identity chrome.
 * Store UI theme must not paint borders/washes on these cards.
 */
export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  expanded,
  onToggle,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const displayName = formatPlayerDisplayName(player);
  const clubYearLabel = formatShowcaseClubYear(player);
  const colorClub = getPlayerColorClub(player);
  const cardColours = useMemo(
    () => getPlayerCardColours(colorClub),
    [colorClub]
  );

  const handleToggle = useCallback(() => {
    if (expanded) playPanelClose();
    else playPanelExpand();
    onToggle(player);
  }, [expanded, player, onToggle]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  return (
    <div
      className={`showcase-player-card game-panel game-panel--flush h-auto w-full min-w-0 self-start overflow-hidden border transition ${
        expanded ? "showcase-player-card--expanded" : "hover:border-pitch-500/50"
      }`}
      style={expanded ? cardColours.expandedStyle : cardColours.style}
    >
      <TeamColourStrip club={colorClub} thick={expanded} />

      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03] sm:py-2.5"
        style={expanded ? { backgroundColor: cardColours.wash } : undefined}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
      >
        <span className="showcase-compact-name min-w-0 flex-1 font-display font-bold leading-snug text-white">
          <span className="block break-words [overflow-wrap:anywhere] line-clamp-3">
            {displayName}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-medium text-gray-400">
            {clubYearLabel}
          </span>
        </span>
        <span className="shrink-0 self-start pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {expanded ? "Close" : "View"}
        </span>
      </button>

      {expanded && (
        <div className="min-w-0 overflow-visible border-t border-pitch-700/40 px-2 pb-2 pt-1 sm:px-2.5">
          <RugbyLeaguePlayerCard
            player={player}
            variant="default"
            compactMobile
            achievementDisplay="showcase"
            allowLongName
            showClubColourBar={false}
            className="!border-0 !bg-transparent !shadow-none"
          />
          <GameButton
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onOpenDetail(player)}
          >
            Full profile
          </GameButton>
        </div>
      )}
    </div>
  );
}, showcaseCardPropsEqual);
