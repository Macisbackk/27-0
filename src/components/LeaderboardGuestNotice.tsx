"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function LeaderboardGuestNotice() {
  const { isLoggedIn, loading } = useAuth();

  if (loading || isLoggedIn) return null;

  return (
    <div
      className={`mb-4 ${CARD.base} border-accent-green/20 bg-accent-green/5 ${SPACING.cardPaddingSm}`}
    >
      <p className={TYPO.body}>
        Log in to submit your own scores. You can still view online leaderboards
        as a guest.
      </p>
      <Link href="/" className={`mt-2 inline-block ${LINK.accent}`}>
        Go to Home →
      </Link>
    </div>
  );
}
