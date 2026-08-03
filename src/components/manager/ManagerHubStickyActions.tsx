"use client";

import { GameButton } from "@/components/ui/GameButton";
import { StickyActionBar } from "@/components/ui/MobileLayout";
import { playSimulateRound, playUiClick } from "@/lib/sound";

interface ManagerHubStickyActionsProps {
  visible: boolean;
  canPlay: boolean;
  playLabel: string;
  simulateLabel: string;
  onPlayGame: () => void;
  onSimulate: () => void;
}

/** Fixed Play / Simulate bar above mobile bottom nav on Manager Hub. */
export function ManagerHubStickyActions({
  visible,
  canPlay,
  playLabel,
  simulateLabel,
  onPlayGame,
  onSimulate,
}: ManagerHubStickyActionsProps) {
  if (!visible) return null;

  return (
    <StickyActionBar aboveNav>
      <GameButton
        variant="theme"
        size="sm"
        className="min-h-[var(--mobile-tap-target)] min-w-0 flex-1"
        disabled={!canPlay}
        onClick={() => {
          playUiClick();
          onPlayGame();
        }}
      >
        {playLabel}
      </GameButton>
      <GameButton
        variant="secondary"
        size="sm"
        className="min-h-[var(--mobile-tap-target)] min-w-0 flex-1"
        disabled={!canPlay}
        onClick={() => {
          playSimulateRound();
          playUiClick();
          onSimulate();
        }}
      >
        {simulateLabel}
      </GameButton>
    </StickyActionBar>
  );
}
