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
  /** End-of-season CTA — replaces Play/Simulate when set. */
  seasonReviewLabel?: string | null;
  onSeasonReview?: () => void;
  /** After a fixture — Progress Week is the primary hub action. */
  advanceWeekLabel?: string | null;
  canAdvanceWeek?: boolean;
  onAdvanceWeek?: () => void;
}

/** Fixed Play / Simulate bar above mobile bottom nav on Manager Hub. */
export function ManagerHubStickyActions({
  visible,
  canPlay,
  playLabel,
  simulateLabel,
  onPlayGame,
  onSimulate,
  seasonReviewLabel,
  onSeasonReview,
  advanceWeekLabel,
  canAdvanceWeek = false,
  onAdvanceWeek,
}: ManagerHubStickyActionsProps) {
  if (seasonReviewLabel && onSeasonReview) {
    return (
      <StickyActionBar
        aboveNav
        portal
        className={visible ? undefined : "invisible pointer-events-none"}
      >
        <GameButton
          variant="theme"
          size="md"
          className="min-h-[var(--mobile-tap-target)] min-w-0 flex-1 text-sm font-semibold"
          disabled={!visible}
          onClick={() => {
            playUiClick();
            onSeasonReview();
          }}
        >
          {seasonReviewLabel}
        </GameButton>
      </StickyActionBar>
    );
  }

  if (advanceWeekLabel && onAdvanceWeek) {
    return (
      <StickyActionBar
        aboveNav
        portal
        className={visible ? undefined : "invisible pointer-events-none"}
      >
        <GameButton
          variant="theme"
          size="md"
          className="min-h-[var(--mobile-tap-target)] min-w-0 flex-1 text-sm font-semibold tracking-wide"
          disabled={!visible || !canAdvanceWeek}
          onClick={() => {
            onAdvanceWeek();
          }}
        >
          {advanceWeekLabel}
        </GameButton>
      </StickyActionBar>
    );
  }

  return (
    <StickyActionBar
      aboveNav
      portal
      className={visible ? undefined : "invisible pointer-events-none"}
    >
      <GameButton
        variant="theme"
        size="sm"
        className="min-h-[var(--mobile-tap-target)] min-w-0 flex-1"
        disabled={!canPlay || !visible}
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
        disabled={!canPlay || !visible}
        onClick={() => {
          playSimulateRound();
          onSimulate();
        }}
      >
        {simulateLabel}
      </GameButton>
    </StickyActionBar>
  );
}
