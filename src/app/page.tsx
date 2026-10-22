import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { PageShell } from "@/components/ui/PageShell";

export default function HomePage() {
  return (
    <PageShell compact className="matchday-arena--flat">
      <h1 className="sr-only">27-0 — rugby league manager and squad builder</h1>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mx-auto mt-2 flex w-full max-w-xl flex-col gap-4">
        <HomeModeSelector />
        <HomeAuthBar />

        <details className="group rounded-[20px] bg-pitch-900 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-[15px] font-bold text-white">
            How to play
            <span aria-hidden className="text-[color:var(--fl-muted)] transition group-open:rotate-90">›</span>
          </summary>
          <div className="pt-2">
            <HowToPlaySection />
          </div>
        </details>

        <nav className="flex flex-wrap justify-center gap-2 pt-1" aria-label="More">
          {[
            ["/store", "Store"],
            ["/profile#achievements", "Achievements"],
            ["/showcase", "Players"],
            ["/settings", "Settings"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="fl-pill bg-pitch-900 text-[color:var(--fl-muted)] hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <div className="text-center">
          <JoeMellorEasterEgg />
        </div>
      </div>
    </PageShell>
  );
}
