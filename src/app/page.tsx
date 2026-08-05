import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { LogoMark } from "@/components/LogoMark";
import { GameHeader } from "@/components/ui/GameHeader";
import { GameShortContent } from "@/components/ui/GameShortContent";
import { PageShell } from "@/components/ui/PageShell";
import { LINK, PAGE, SPACING } from "@/lib/ui/design-system";

export default function HomePage() {
  return (
    <PageShell withLights compact>
      <div className={PAGE.sectionHero}>
        <GameHeader
          title={
            <GameShortContent>
              <span className="flex flex-col items-center gap-1.5">
                <LogoMark size="lg" className="justify-center" />
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-pitch-400 sm:text-xs">
                  Work in progress
                </span>
              </span>
            </GameShortContent>
          }
          subtitle={
            <>
              Manager Mode is the main career. Quick Mode builds a squad fast —
              can you go 27-0?
            </>
          }
          className="mx-auto max-w-2xl text-center [&_.game-header__title]:flex [&_.game-header__title]:justify-center"
        />
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
        </div>
        <JoeMellorEasterEgg />
      </div>
    </PageShell>
  );
}
