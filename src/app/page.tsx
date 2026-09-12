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
import { GAME_VERSION } from "../../data/version";

export default function HomePage() {
  return (
    <PageShell withLights compact className="matchday-arena--flat">
      <section className={`${PAGE.sectionHero} text-center`}>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
          <LogoMark size="lg" className="items-center justify-center" />
          <p className={`${TYPO.meta} uppercase tracking-[0.18em]`}>
            {GAME_VERSION}
          </p>
        </div>

        <h1 className="sr-only">27-0</h1>
        <p className={`mx-auto mt-3 max-w-lg sm:mt-4 ${TYPO.pageSubtitle}`}>
          Build a Super League side and chase the perfect season.
        </p>
      </section>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className={SPACING.sectionGap}>
        <HomeAuthBar />
      </div>

      <div id="play-modes" className={`scroll-mt-8 ${SPACING.sectionGap}`}>
        <HomeModeSelector />
      </div>

      <div className={SPACING.sectionGap}>
        <HowToPlaySection />
      </div>

      <nav
        className={`mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-[var(--mobile-divider)] pt-4 text-center sm:pt-5 ${SPACING.sectionGap}`}
        aria-label="More"
      >
        <Link href="/leaderboard" className={LINK.subtle}>
          Leaderboard
        </Link>
        <Link href="/profile#achievements" className={LINK.subtle}>
          Achievements
        </Link>
        <Link href="/store" className={LINK.subtle}>
          Store
        </Link>
        <Link href="/showcase" className={LINK.subtle}>
          Players
        </Link>
      </nav>
      <div className="mt-4 text-center">
        <JoeMellorEasterEgg />
      </div>
    </PageShell>
  );
}
