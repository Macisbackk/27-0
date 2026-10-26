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

      <div className="mx-auto mt-2 flex w-full max-w-[44rem] flex-col gap-4">
        <HomeModeSelector />
        <HomeAuthBar />

        <details className="group order-last rounded-card px-4">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center gap-2 py-1 text-[14px] font-semibold text-[color:var(--fl-muted)] hover:text-white [&::-webkit-details-marker]:hidden">
            How to play
            <span aria-hidden className="text-[color:var(--fl-muted)] transition group-open:rotate-90">›</span>
          </summary>
          <div className="pt-2">
            <HowToPlaySection />
          </div>
        </details>

        <nav className="flex flex-wrap justify-center gap-2 pt-1" aria-label="More">
          {[
            ["/leaderboard", "Leaderboard"],
            ["/squad-book", "Squad Book"],
            ["/records", "Records"],
            ["/store", "Store"],
            ["/showcase", "Players"],
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
