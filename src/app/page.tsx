import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { LogoMark } from "@/components/LogoMark";
import { PageShell } from "@/components/ui/PageShell";
import { LINK, PAGE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function HomePage() {
  return (
    <PageShell withLights compact>
      <div className={PAGE.sectionHero}>
        <p className={TYPO.sectionLabel}>Rugby League Squad Builder</p>
        <h1 className="mt-3">
          <LogoMark size="lg" className="justify-center" />
        </h1>
        <p className={`mt-4 ${TYPO.pageSubtitle}`}>
          Manager Mode puts you in the dugout. Quick Mode is the fast squad-builder
          — can you go 27-0?
        </p>
        <p className={`mt-2 ${TYPO.bodySm}`}>
          Build your squad on the team sheet and chase perfection.
        </p>
      </div>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mt-8">
        <HomeAuthBar />
      </div>

      <div id="play-modes" className="mt-8 scroll-mt-8">
        <HomeModeSelector />
      </div>

      <div className="mt-8">
        <HowToPlaySection />
      </div>

      <div
        className={`mt-8 flex flex-col items-center ${SPACING.buttonGap} text-center`}
      >
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/leaderboard" className={LINK.subtle}>
            View Leaderboard →
          </Link>
          <Link href="/showcase" className={LINK.subtle}>
            Player Showcase →
          </Link>
          <Link href="/updates" className={LINK.subtle}>
            Updates →
          </Link>
        </div>
        <JoeMellorEasterEgg />
      </div>
    </PageShell>
  );
}
