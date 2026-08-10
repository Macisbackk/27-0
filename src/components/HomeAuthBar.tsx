"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="mx-auto max-w-md border-b border-[var(--mobile-divider)] pb-[var(--mobile-section-gap)] text-center">
      <Link href="/login" className={`${BTN.base} ${BTN.accentOutline} inline-flex`}>
        Log in / Create account
      </Link>
      <p className={`mt-3 ${TYPO.meta}`}>
        Guest saves stay here. Log in for leaderboards.
      </p>
    </section>
  );
}
