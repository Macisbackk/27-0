"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";

interface GuestSaveNudgeProps {
  context: "manager-season" | "quick-season" | "daily-challenge";
}

/** Guest CTA after a season — sign in so the run can rank or sync streak. */
export function GuestSaveNudge({ context }: GuestSaveNudgeProps) {
  const copy =
    context === "manager-season"
      ? {
          body: "Log in to sync. Export for backup.",
          href: "/login?redirect=/leaderboard",
          cta: "Log in to submit",
        }
      : context === "daily-challenge"
        ? {
            body: "Log in to sync your Daily Challenge streak.",
            href: "/login?redirect=/leaderboard?tracker=daily_streak",
            cta: "Save my streak",
          }
        : {
            body: "Log in to submit this season to the leaderboard.",
            href: "/login?redirect=/leaderboard",
            cta: "Log in to submit",
          };

  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} text-center`}
    >
      <p className="text-sm font-semibold text-amber-300">{copy.body}</p>
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
