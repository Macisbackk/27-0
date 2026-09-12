"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface GuestSaveNudgeProps {
  context: "manager-season" | "quick-season";
}

/** Guest CTA after a Quick Mode season — sign in so the run can rank online. */
export function GuestSaveNudge({ context }: GuestSaveNudgeProps) {
  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} border border-amber-400/30 bg-amber-500/5 text-center`}
    >
      <p className={`${TYPO.bodySm} text-amber-100`}>
        {context === "manager-season"
          ? "Sign in to sync. Export for backup."
          : "Sign in to submit this season to the leaderboard."}
      </p>
      <GameButton
        variant="secondary"
        size="sm"
        href="/login?redirect=/leaderboard"
        className="mt-2"
      >
        Sign in to submit
      </GameButton>
    </div>
  );
}
