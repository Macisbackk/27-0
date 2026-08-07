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

export default function HomePage() {
  return (
    <PageShell withLights compact>
      <div className={`${PAGE.sectionHero} text-center`}>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <LogoMark size="lg" className="items-center justify-center" />
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-pitch-400 sm:text-xs">
            Work in progress
          </p>
          <p className="max-w-sm text-center text-[length:var(--text-body)] leading-snug text-[var(--mobile-text-secondary)]">
            Rugby league management and Quick Mode. Build a side. Go 27-0.
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mt-6">
        <HomeAuthBar />
      </div>

      <div id="play-modes" className="mt-8 scroll-mt-8">
        <HomeModeSelector />
      </div>

      <div className="mt-10">
        <HowToPlaySection />
      </div>

      <div
        className={`mt-8 flex flex-col items-center ${SPACING.buttonGap} text-center`}
      >
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/leaderboard" className={LINK.subtle}>
            Leaderboard
          </Link>
          <Link href="/showcase" className={LINK.subtle}>
            Player Showcase
          </Link>
        </div>
        <JoeMellorEasterEgg />
      </div>
    </PageShell>
  );
}
