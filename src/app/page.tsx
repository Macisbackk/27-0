import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { PageShell } from "@/components/ui/PageShell";
import { HomeMoreLinks } from "@/components/HomeMoreLinks";

export default function HomePage() {
  return (
    <PageShell compact className="matchday-arena--flat">
      <h1 className="sr-only">27-0 — rugby league manager and squad builder</h1>

      <Suspense fallback={null}>
        <EmailConfirmedBanner />
      </Suspense>

      <div className="mx-auto mt-1 flex w-full max-w-[44rem] flex-col gap-3">
        <HomeModeSelector />

        <div className="flex justify-center pt-1">
          <HomeAuthBar />
        </div>

        <HomeMoreLinks />

        <details className="group rounded-card px-4">
          <summary className="mx-auto flex min-h-[44px] w-max cursor-pointer list-none items-center justify-center gap-1.5 px-3 text-[13px] font-semibold text-[color:var(--fl-muted)] hover:text-white [&::-webkit-details-marker]:hidden">
            How to play
            <span aria-hidden className="transition group-open:rotate-90">›</span>
          </summary>
          <div className="pt-2">
            <HowToPlaySection />
          </div>
        </details>
        <div className="text-center">
          <JoeMellorEasterEgg />
        </div>
      </div>
    </PageShell>
  );
}
