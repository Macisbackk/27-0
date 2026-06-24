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
          <h3 className={TYPO.sectionTitle}>How To Play</h3>
          <div className={`mt-5 space-y-6 ${TYPO.bodySm}`}>
            <HowToPlayBlock
              title="Normal Mode"
              items={[
                "Pick a position on the team sheet.",
                "Spin for a club or era team-year.",
                "Choose from the players offered.",
                "Build a full rugby league squad.",
                "Simulate the season and try to go 27-0.",
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <HowToPlayBlock
                title="Current"
                items={[
                  "Uses 2026 Super League squads.",
                  "Spins show clubs only.",
                  "All opponent teams are current 2026 teams.",
                ]}
                compact
              />
              <HowToPlayBlock
                title="Era"
                items={[
                  "Uses historic Super League team-year squads.",
                  "Spins show club + year.",
                  "Exact team-year pools — no 2026 teams.",
                ]}
                compact
                era
              />
            </div>
            <HowToPlayBlock
              title="Challenge Cup"
              items={[
                "Pick or randomise a team.",
                "Build or select your squad.",
                "Play through the cup bracket.",
                "Try to win the trophy.",
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <HowToPlayBlock
                title="Current Challenge Cup"
                items={[
                  "2026 Super League clubs.",
                  "Current squads and opponents.",
                ]}
                compact
              />
              <HowToPlayBlock
                title="Era Challenge Cup"
                items={[
                  "Pick a historic team-year squad.",
                  "Era teams across the full bracket.",
                ]}
                compact
                era
              />
            </div>
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

function HowToPlayBlock({
  title,
  items,
  compact = false,
  era = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
  era?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? `rounded-lg border px-3 py-3 ${
              era
                ? "border-accent-gold/30 bg-accent-gold/5"
                : "border-pitch-700/50 bg-pitch-950/40"
            }`
          : ""
      }
    >
      <h4
        className={`font-display font-bold ${
          era ? "text-accent-gold" : "text-white"
        } ${compact ? TYPO.bodySm : TYPO.statValue}`}
      >
        {title}
      </h4>
      <ul className={`mt-2 space-y-1 ${TYPO.bodySm} text-gray-400`}>
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
