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
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_42%),linear-gradient(180deg,rgba(12,19,17,0.98),rgba(7,11,10,0.98))] px-3 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:rounded-[1.75rem] sm:px-6 sm:py-8">
          <div className="mx-auto hidden max-w-xl flex-col items-center gap-2 sm:flex">
            <LogoMark size="lg" className="items-center justify-center" />
            <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-pitch-300 sm:text-xs">
              {GAME_VERSION}
            </p>
          </div>

          <div className="mx-auto max-w-3xl sm:mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-primary sm:text-xs sm:tracking-[0.18em]">
              Build your Super League dream team
            </p>
            <h1 className="mt-2 font-display text-[1.7rem] font-black leading-tight tracking-tight text-white sm:mt-3 sm:text-[clamp(2.2rem,5.6vw,4.35rem)]">
              Current stars. Era legends.
              <span className="block sm:inline"> One chase for 27-0.</span>
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-snug text-gray-300 sm:mt-3 sm:text-lg sm:leading-relaxed">
              Draft a side and chase the perfect season — modern squads or era
              icons.
            </p>
          </div>

          <div className="mx-auto mt-3 hidden w-full max-w-xl flex-col gap-2 sm:mt-5 sm:flex sm:flex-row">
            <Link
              href="#play-modes"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-theme-primary/35 bg-theme-primary/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-theme-primary/15"
            >
              Choose a mode
            </Link>
            <Link
              href="/showcase"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10"
            >
              Browse players
            </Link>
          </div>

          <div className="mx-auto mt-6 hidden w-full max-w-4xl gap-3 md:grid md:grid-cols-[1.1fr_1.1fr_0.8fr]">
            <div className="rounded-2xl border border-theme-primary/20 bg-[linear-gradient(180deg,rgba(6,34,28,0.92),rgba(10,17,15,0.96))] px-4 py-4 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-primary">
                Current Mode
              </p>
              <p className="mt-2 font-display text-xl font-bold text-white">
                Modern squads and live-era builds
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Start fast with today&apos;s Super League talent and push through
                league and playoffs.
              </p>
            </div>
            <div className="rounded-2xl border border-accent-gold/25 bg-[linear-gradient(180deg,rgba(46,35,10,0.92),rgba(12,16,14,0.96))] px-4 py-4 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-gold">
                Era Mode
              </p>
              <p className="mt-2 font-display text-xl font-bold text-white">
                Historic players and classic teams
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Mix icons from different seasons and build a dream team from rugby
                league history.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-pitch-300">
                Win Condition
              </p>
              <p className="mt-2 font-display text-3xl font-black text-white">27-0</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Chase trophies, build chemistry, and try to complete the perfect
                season.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mt-3 sm:mt-5">
        <HomeAuthBar />
      </div>

      <div id="play-modes" className="mt-4 scroll-mt-8 sm:mt-8">
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
