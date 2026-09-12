"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface GuestSaveNudgeProps {
  context: "manager-season" | "quick-season" | "daily-challenge";
}

/** Guest CTA after a season — sign in so the run can rank or sync streak. */
export function GuestSaveNudge({ context }: GuestSaveNudgeProps) {
  const copy =
    context === "manager-season"
      ? {
          body: "Sign in to sync. Export for backup.",
          href: "/login?redirect=/leaderboard",
          cta: "Sign in to submit",
        }
      : context === "daily-challenge"
        ? {
            body: "Sign in to sync your Daily Challenge streak.",
            href: "/login?redirect=/leaderboard?tracker=daily_streak",
            cta: "Sign in to sync streak",
          }
        : {
            body: "Sign in to submit this season to the leaderboard.",
            href: "/login?redirect=/leaderboard",
            cta: "Sign in to submit",
          };

  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} border border-amber-400/30 bg-amber-500/5 text-center`}
    >
      <p className={`${TYPO.bodySm} text-amber-100`}>{copy.body}</p>
      <GameButton
        variant="secondary"
        size="sm"
        href={copy.href}
        className="mt-2"
      >
        {copy.cta}
      </GameButton>
    </div>
  );
}
