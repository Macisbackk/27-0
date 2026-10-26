import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { PageShell } from "@/components/ui/PageShell";
import { CARD, PAGE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export const metadata: Metadata = {
  title: "Log in — 27-0",
  description: "Log in or create a coach profile for online leaderboards.",
};

export default function LoginPage() {
  return (
    <PageShell withLights compact>
      <div className={`${PAGE.content} ${PAGE.section}`}>
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center">
            <p className={TYPO.sectionLabel}>Account</p>
            <h1 className={`mt-2 ${TYPO.pageTitle}`}>Log in</h1>
            <p className={`mt-2 ${TYPO.bodySm}`}>
              Log in or create a free account to save your progress online and join the leaderboards.
            </p>
          </div>

          <Suspense
            fallback={
              <div
                className={`${CARD.panel} ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}
              >
                Loading…
              </div>
            }
          >
            <LoginForm />
          </Suspense>

        </div>
      </div>
    </PageShell>
  );
}
