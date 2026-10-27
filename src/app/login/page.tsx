import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { PageShell } from "@/components/ui/PageShell";
import { CARD, PAGE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { PitchHero } from "@/components/ui/PitchHero";
import { WhistleGlyph } from "@/components/icons/rugby-icons";

export const metadata: Metadata = {
  title: "Log in — 27-0",
  description: "Log in or create a coach profile for online leaderboards.",
};

export default function LoginPage() {
  return (
    <PageShell withLights compact>
      <div className={`${PAGE.content} ${PAGE.section}`}>
        <div className="mx-auto w-full max-w-md">
          <PitchHero
            className="mb-5"
            eyebrow="Account"
            title="Log in"
            description="Save your progress and join the leaderboards."
===
            icon={<WhistleGlyph />}
          />

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
