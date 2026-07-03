import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function LoginPage() {
  return (
    <div className="matchday-arena flex min-h-full flex-1 flex-col">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-md ${SPACING.pageX} py-8 sm:py-12`}>
        <div className="mb-8 text-center">
          <p className={TYPO.sectionLabel}>Account</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Log In</h1>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Sign in or create a coach profile for online leaderboards.
          </p>
        </div>

        <Suspense
          fallback={
            <div className={`${CARD.panel} ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}>
              Loading…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className={`mt-6 text-center ${TYPO.bodySm}`}>
          <Link href="/" className={LINK.accent}>
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  );
}
