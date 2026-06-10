"use client";

import Link from "next/link";
import { BTN, SPACING } from "@/lib/ui/design-system";

interface ReviewPlayAgainProps {
  onPlayAgain: () => void;
  leaderboardHref?: string;
  compact?: boolean;
  hardMode?: boolean;
}

export function ReviewPlayAgain({
  onPlayAgain,
  leaderboardHref = "/leaderboard",
  compact = false,
  hardMode = false,
}: ReviewPlayAgainProps) {
  return (
    <div
      className={`w-full max-w-xl ${SPACING.stackMd} ${compact ? "" : "mt-2"}`}
    >
      <button
        type="button"
        onClick={onPlayAgain}
        className={`${BTN.base} ${hardMode ? BTN.primaryLgHard : BTN.primaryLg}`}
      >
        Play Again
      </button>
      <div className={`grid grid-cols-2 ${SPACING.buttonGap}`}>
        <Link href="/" className={`${BTN.base} ${BTN.secondaryLg}`}>
          Return Home
        </Link>
        <Link href={leaderboardHref} className={`${BTN.base} ${BTN.secondaryLg}`}>
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
