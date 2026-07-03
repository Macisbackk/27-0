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
    <div
      className="fixed inset-x-0 z-40 border-t border-pitch-700/60 bg-pitch-950/95 px-3 py-2 backdrop-blur-md sm:hidden"
      style={{
        bottom: "calc(3.25rem + max(0.5rem, env(safe-area-inset-bottom)))",
      }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
        <GameButton
          variant="theme"
          size="sm"
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
