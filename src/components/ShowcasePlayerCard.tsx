"use client";

import { memo, useCallback } from "react";
import type { Player } from "@/lib/types";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { playUiClick } from "@/lib/sound";

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

export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  expanded,
  onToggle,
  onOpenDetail,
}: ShowcasePlayerCardProps) {
  const displayName = formatPlayerDisplayName(player);

  const handleToggle = useCallback(() => {
    playUiClick();
    onToggle(player);
  }, [player, onToggle]);

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
    <div className="showcase-player-card min-w-0">
      <button
        type="button"
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
          expanded
            ? "border-accent-green/50 bg-accent-green/10"
            : "border-pitch-700/60 bg-pitch-900/40 hover:border-accent-green/35 hover:bg-pitch-900/70"
        }`}
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <span className="truncate font-display text-sm font-bold text-white sm:text-base">
          {displayName}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {expanded ? "Close" : "View"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 min-w-0">
          <RugbyLeaguePlayerCard
            player={player}
            variant="default"
            equalHeight
            compactMobile
            achievementDisplay="showcase"
          />
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-pitch-600/50 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-accent-green/40 hover:text-accent-green"
            onClick={() => {
              playUiClick();
              onOpenDetail(player);
            }}
          >
            Full profile
          </button>
        </div>
      )}
    </div>
  );
}, showcaseCardPropsEqual);
