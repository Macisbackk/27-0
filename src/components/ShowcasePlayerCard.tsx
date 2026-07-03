"use client";

import { memo, useCallback } from "react";
import type { Player } from "@/lib/types";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { formatShowcaseClubYear } from "@/lib/players/year-card";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { ClubColourBar } from "./ClubBadge";
import { playPanelClose, playPanelExpand } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";

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
  const clubYearLabel = formatShowcaseClubYear(player);

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
      className={`showcase-player-card h-auto w-full min-w-0 self-start overflow-hidden transition ${
        expanded
          ? "showcase-player-card--expanded border-accent-green/40"
          : "hover:border-pitch-500/50"
      } ${CARD.base}`}
    >
      <ClubColourBar club={player.club} />

      <button
        type="button"
        className={`flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition sm:py-2.5 ${
          expanded ? "bg-accent-green/5" : "hover:bg-pitch-900/60"
        }`}
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
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-pitch-600/50 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-accent-green/40 hover:text-accent-green"
            onClick={() => {
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
