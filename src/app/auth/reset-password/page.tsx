import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function ResetPasswordPage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-md ${SPACING.pageX} py-12 sm:py-16`}>
        <div className="mb-8 text-center">
          <p className={TYPO.sectionLabel}>Account</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Reset Password</h1>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Set a new password for your coach account.
          </p>
        </div>

        <Suspense
          fallback={
            <div className={`${CARD.panel} ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}>
              Loading…
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <p className={`mt-6 text-center ${TYPO.bodySm}`}>
          <Link href="/login" className={LINK.accent}>
            ← Back to Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
