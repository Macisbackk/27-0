import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { LogoMark } from "@/components/LogoMark";
import { PageShell } from "@/components/ui/PageShell";
import { LINK, PAGE } from "@/lib/ui/design-system";
import { GAME_VERSION } from "../../data/version";

export default function HomePage() {
  return (
    <PageShell withLights compact>
      <div className={`${PAGE.sectionHero} text-center`}>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
          <LogoMark size="lg" className="items-center justify-center" />
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-pitch-400 sm:text-xs">
            {GAME_VERSION}
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mt-4">
        <HomeAuthBar />
      </div>

      <div id="play-modes" className="mt-6 scroll-mt-8">
        <HomeModeSelector />
      </div>

      <nav
        className="mx-auto mt-7 flex max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-[var(--mobile-divider)] pt-5 text-center"
        aria-label="More"
      >
        <Link href="/leaderboard" className={LINK.subtle}>Leaderboard</Link>
        <Link href="/profile#achievements" className={LINK.subtle}>Achievements</Link>
        <Link href="/store" className={LINK.subtle}>Store</Link>
        <Link href="/showcase" className={LINK.subtle}>Players</Link>
      </nav>
      <div className="mt-4 text-center">
        <JoeMellorEasterEgg />
      </div>
    </PageShell>
  );
}
