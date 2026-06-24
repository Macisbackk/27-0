"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className={`${CARD.panel} mx-auto max-w-md ${SPACING.cardPadding} text-center`}>
      <p className={TYPO.sectionTitle}>Get Started</p>
      <div className={`mt-4 flex flex-col ${SPACING.buttonGap} sm:flex-row sm:justify-center`}>
        <Link href="#play-modes" className={`${BTN.theme} text-center`}>
          Play as Guest
        </Link>
        <Link href="/login" className={`${BTN.base} ${BTN.accentOutline}`}>
          Log In
        </Link>
        <Link href="/login" className={`${BTN.base} ${BTN.secondary}`}>
          Create Account
        </Link>
      </div>
      <p className={`mt-3 ${TYPO.bodySm}`}>
        Guest play saves stats on this device only. Log in to submit online
        leaderboard scores.
      </p>
    </section>
  );
}
