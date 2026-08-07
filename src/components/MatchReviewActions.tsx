"use client";

import type { ReactNode } from "react";
import { ActionButton } from "./ui/ActionButton";
import { ReturnHomeButton } from "./ReturnHomeButton";
import { SPACING } from "@/lib/ui/design-system";

export interface MatchReviewActionsProps {
  onPlayAgain?: () => void;
  onReturnHome?: () => void;
  leaderboardHref?: string;
  /** Alternate primary action (e.g. Continue to Play-Offs). */
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Hide Play Again + Leaderboard (playoff continuation). */
  hideEndOfRunNav?: boolean;
  /** Optional notice above the action group. */
  notice?: ReactNode;
  /** Share season card control (Quick Mode end of run). */
  shareAction?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Shared centred Match Review action group for Quick Modes and Easter egg modes.
 * Desktop: centred column. Mobile: full-width stacked buttons of equal height.
 */
export function MatchReviewActions({
  onPlayAgain,
  onReturnHome,
  leaderboardHref = "/leaderboard",
  primaryAction,
  hideEndOfRunNav = false,
  notice,
  shareAction,
  compact = false,
  className = "",
}: MatchReviewActionsProps) {
  const showEndNav = !hideEndOfRunNav && Boolean(onPlayAgain);

  return (
    <div
      className={`flex w-full justify-center ${compact ? "" : "mt-2"} ${className}`}
    >
      <div
        className={`flex w-full max-w-xl flex-col items-stretch ${SPACING.stackMd}`}
      >
        {notice ? (
          <div className="w-full text-center text-sm text-pitch-400">{notice}</div>
        ) : null}

        {primaryAction ? (
          <ActionButton variant="theme" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </ActionButton>
        ) : null}

        {showEndNav ? (
          <>
            <ActionButton variant="theme" onClick={onPlayAgain}>
              Play Again
            </ActionButton>
            {shareAction}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${SPACING.buttonGap}`}
            >
              <ActionButton variant="theme" href={leaderboardHref}>
                Leaderboard
              </ActionButton>
              {onReturnHome ? (
                <ReturnHomeButton onBeforeNavigate={onReturnHome} />
              ) : (
                <ActionButton variant="theme" href="/">
                  Return Home
                </ActionButton>
              )}
            </div>
          </>
        ) : null}

        {!showEndNav && !primaryAction && onReturnHome ? (
          <ReturnHomeButton onBeforeNavigate={onReturnHome} />
        ) : null}
      </div>
    </div>
  );
}
