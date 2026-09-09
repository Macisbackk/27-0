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
      <section className={`${PAGE.sectionHero} text-center`}>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
          <LogoMark size="lg" className="items-center justify-center" />
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-pitch-300 sm:text-xs">
            {GAME_VERSION}
          </p>
        </div>

        <h1 className="sr-only">27-0</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-snug text-gray-300 sm:mt-4 sm:text-base sm:leading-relaxed">
          Draft a Super League side and chase the perfect season.
        </p>
      </section>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mt-4 sm:mt-5">
        <HomeAuthBar />
      </div>

      <div id="play-modes" className="mt-5 scroll-mt-8 sm:mt-7">
        <HomeModeSelector />
      </div>

      <nav
        className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-[var(--mobile-divider)] pt-4 text-center sm:mt-8 sm:pt-5"
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
