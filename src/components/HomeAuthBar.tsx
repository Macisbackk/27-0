"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="mx-auto max-w-md border-b border-[var(--mobile-divider)] pb-[var(--mobile-section-gap)] text-center">
      <div className={`flex flex-col ${SPACING.buttonGap} sm:flex-row sm:justify-center`}>
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
      <p className={`mt-3 ${TYPO.meta}`}>
        Guest saves on this device. Log in for online leaderboard.
      </p>
    </section>
  );
}
