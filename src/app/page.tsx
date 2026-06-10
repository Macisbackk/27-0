import Link from "next/link";
import { Suspense } from "react";
import { HomeAuthBar } from "@/components/HomeAuthBar";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function HomePage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-4xl ${SPACING.pageX} py-12 sm:py-20`}>
        <div className="text-center">
          <p className={TYPO.sectionLabel}>Rugby League Squad Builder</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-7xl">
            <span className="text-gradient">27</span>
            <span className="text-white">-0</span>
          </h1>
          <p className={`mt-4 ${TYPO.pageSubtitle}`}>
            Build the most valuable Super League team through strategic
            recruitment.
          </p>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Build your squad on the team sheet — can you go 27-0?
          </p>
        </div>

        <Suspense fallback={null}>
          <EmailConfirmedBanner />
        </Suspense>

        <div className="mt-10">
          <HomeAuthBar />
        </div>

        <div id="play-modes" className="mt-8 scroll-mt-8">
          <HomeModeSelector />
        </div>

        <div className={`mt-8 ${CARD.panel} ${SPACING.cardPaddingLg}`}>
          <h3 className={TYPO.sectionTitle}>How It Works</h3>
          <div className={`mt-4 grid ${SPACING.cardGridGap} sm:grid-cols-3`}>
            <Step
              num="1"
              title="Click the Pitch"
              desc="Recruit directly from the team sheet — click any open position."
            />
            <Step
              num="2"
              title="Choose One of Two"
              desc="Pick between two real players with tight ratings — the other walks away."
            />
            <Step
              num="3"
              title="Quest for 27-0"
              desc="Simulate a full Super League season. Can your squad win every game?"
            />
          </div>
        </div>

        <div className={`mt-8 flex flex-col items-center ${SPACING.buttonGap} text-center`}>
          <div className={`flex flex-wrap items-center justify-center gap-4`}>
            <Link href="/leaderboard" className={LINK.subtle}>
              View Leaderboard →
            </Link>
            <Link href="/showcase" className={LINK.subtle}>
              Player Showcase →
            </Link>
          </div>
          <JoeMellorEasterEgg />
        </div>
      </div>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <span className="font-display text-2xl font-black text-pitch-600/80">
        {num}
      </span>
      <h4 className={`mt-1 font-display font-bold ${TYPO.statValue}`}>{title}</h4>
      <p className={`mt-1 ${TYPO.bodySm}`}>{desc}</p>
    </div>
  );
}
