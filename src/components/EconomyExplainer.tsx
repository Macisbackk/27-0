"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface GuestSaveNudgeProps {
  context: "manager-season" | "quick-season";
}

export function GuestSaveNudge({ context }: GuestSaveNudgeProps) {
  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} border border-amber-400/30 bg-amber-500/5`}
    >
      <p className={`${TYPO.bodySm} text-amber-100`}>
        {context === "manager-season"
          ? "Sign in to sync your career to your account across devices. Export from the Manager landing screen for an extra backup."
          : "Sign in to sync stats and leaderboard entries across devices."}
      </p>
      <GameButton variant="secondary" size="sm" href="/login" className="mt-2">
        Sign in
      </GameButton>
    </div>
  );
}
