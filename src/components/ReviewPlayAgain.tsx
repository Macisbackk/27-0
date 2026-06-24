"use client";

import { ActionButton } from "./ui/ActionButton";
import { SPACING } from "@/lib/ui/design-system";

interface ReviewPlayAgainProps {
  onPlayAgain: () => void;
  leaderboardHref?: string;
  compact?: boolean;
  hardMode?: boolean;
  /** When true, omit Return Home (caller provides a single footer button). */
  hideReturnHome?: boolean;
}

export function ReviewPlayAgain({
  onPlayAgain,
  leaderboardHref = "/leaderboard",
  compact = false,
  hardMode = false,
  hideReturnHome = false,
}: ReviewPlayAgainProps) {
  return (
    <div
      className={`w-full max-w-xl ${SPACING.stackMd} ${compact ? "" : "mt-2"}`}
    >
      <ActionButton variant="primary" hardMode={hardMode} onClick={onPlayAgain}>
        Play Again
      </ActionButton>
      <div
        className={`grid ${hideReturnHome ? "grid-cols-1" : "grid-cols-2"} ${SPACING.buttonGap}`}
      >
        {!hideReturnHome && (
          <ActionButton variant="secondary" href="/">
            Return Home
          </ActionButton>
        )}
        <ActionButton variant="secondary" href={leaderboardHref}>
          Leaderboard
        </ActionButton>
      </div>
    </div>
  );
}
