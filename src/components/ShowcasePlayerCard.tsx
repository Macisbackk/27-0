"use client";

import { memo, useCallback } from "react";
import type { Player } from "@/lib/types";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { playUiClick } from "@/lib/sound";

interface ShowcasePlayerCardProps {
  player: Player;
  onSelect: (player: Player) => void;
}

function showcaseCardPropsEqual(
  prev: ShowcasePlayerCardProps,
  next: ShowcasePlayerCardProps
): boolean {
  return prev.player.id === next.player.id && prev.onSelect === next.onSelect;
}

export const ShowcasePlayerCard = memo(function ShowcasePlayerCard({
  player,
  onSelect,
}: ShowcasePlayerCardProps) {
  const handleOpen = useCallback(() => {
    playUiClick();
    onSelect(player);
  }, [player, onSelect]);

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
      role="button"
      tabIndex={0}
      className="showcase-player-card cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-green/50"
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <RugbyLeaguePlayerCard
        player={player}
        variant="default"
        equalHeight
        compactMobile
        achievementDisplay="showcase"
      />
    </div>
  );
}, showcaseCardPropsEqual);
