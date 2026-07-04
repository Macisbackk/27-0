"use client";

import { GameButton } from "@/components/ui/GameButton";
import { playSimulateRound, playUiClick } from "@/lib/sound";

interface ManagerHubStickyActionsProps {
  visible: boolean;
  canPlay: boolean;
  isPlayoffFixture: boolean;
  onPlayGame: () => void;
  onSimulate: () => void;
}

/** Fixed Play / Simulate bar above mobile bottom nav on Manager Hub. */
export function ManagerHubStickyActions({
  visible,
  canPlay,
  isPlayoffFixture,
  onPlayGame,
  onSimulate,
}: ManagerHubStickyActionsProps) {
  if (!visible) return null;

  return (
    <div className="manager-mobile-play-bar fixed inset-x-0 z-40 flex items-center border-t border-pitch-700/60 bg-pitch-950/98 px-3 backdrop-blur-md sm:hidden">
      <div className="mx-auto flex w-full max-w-lg gap-2">
        <GameButton
          variant="theme"
          size="sm"
          className="min-h-[44px] min-w-0 flex-1"
          disabled={!canPlay}
          onClick={() => {
            playUiClick();
            onPlayGame();
          }}
        >
          {isPlayoffFixture ? "Play Tie" : "Play Match"}
        </GameButton>
        <GameButton
          variant="secondary"
          size="sm"
          className="min-h-[44px] min-w-0 flex-1"
          disabled={!canPlay}
          onClick={() => {
            playSimulateRound();
            playUiClick();
            onSimulate();
          }}
        >
          Simulate
        </GameButton>
      </div>
    </div>
  );
}
