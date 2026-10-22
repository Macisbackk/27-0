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
        className={`flex w-full max-w-xl flex-col items-stretch ${SPACING.stackSm}`}
      >
        {notice ? (
          <div className="w-full text-center text-sm text-[color:var(--fl-muted)]">{notice}</div>
        ) : null}

        {primaryAction ? (
          <ActionButton variant="theme" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </ActionButton>
        ) : null}

        {showEndNav ? (
          <>
            <ActionButton variant="theme" onClick={onPlayAgain}>
              Play again
            </ActionButton>
            {shareAction}
            <div
              className={`grid grid-cols-1 gap-2 sm:grid-cols-2`}
            >
              <ActionButton variant="secondary" href={leaderboardHref}>
                Leaderboard
              </ActionButton>
              {onReturnHome ? (
                <ReturnHomeButton
                  variant="secondary"
                  onBeforeNavigate={onReturnHome}
                />
              ) : (
                <ActionButton variant="secondary" href="/">
                  Return home
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
