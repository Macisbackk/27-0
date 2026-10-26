import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { PageShell } from "@/components/ui/PageShell";
import { AlbumGlyph, CupGlyph, LadderGlyph, ShopGlyph } from "@/components/icons/rugby-icons";

const FOOTER_LINKS = [
  { href: "/leaderboard", label: "Leaderboard", icon: <LadderGlyph /> },
  { href: "/squad-book", label: "Squad Book", icon: <AlbumGlyph /> },
  { href: "/records", label: "Records", icon: <CupGlyph /> },
  { href: "/store", label: "Store", icon: <ShopGlyph /> },
];

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

        <nav className="grid grid-cols-4 gap-1 border-t border-white/[0.07] pt-3" aria-label="More">
          {FOOTER_LINKS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-control text-[12px] font-semibold text-[color:var(--fl-muted)] hover:bg-pitch-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/70"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
              {label}
            </Link>
          ))}
        </nav>

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
