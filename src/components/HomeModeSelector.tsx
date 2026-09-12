"use client";

import Link from "next/link";
import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { buildPlayHref } from "@/lib/play-links";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";
import { SPACING } from "@/lib/ui/design-system";

export function HomeModeSelector() {
  return (
    <section className="mx-auto w-full max-w-4xl text-center" aria-labelledby="play-heading">
      <p id="play-heading" className={TYPO.keyLabel}>
        Play
      </p>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <HomePlayChoice
          eyebrow="Current squads · 2026"
          title="Quick Mode"
          href={buildPlayHref("classic", false)}
          variant="current"
          cta="Play Current"
          onClick={() => {
            setNormalEraVariant(false);
            playUiClick();
            playModeClassicStart("NORMAL");
          }}
        />
        <HomePlayChoice
          eyebrow="Historic squads"
          title="Era Quick Mode"
          href={buildPlayHref("classic", true)}
          variant="era"
          cta="Play Era"
          onClick={() => {
            setNormalEraVariant(true);
            playUiClick();
            playModeClassicStart("NORMAL");
          }}
        />
      </div>

      <p className="mt-5 sm:mt-6">
        <Link
          href="/mini-games"
          onClick={() => playUiClick()}
          className="text-sm font-semibold text-theme-primary hover:underline"
        >
          Mini Games
        </Link>
        {SHOW_DAILY_CHALLENGE_UI ? (
          <>
            <span className="mx-2 text-pitch-600">·</span>
            <Link
              href="/play?daily=1"
              onClick={() => {
                setNormalEraVariant(false);
                playUiClick();
              }}
              className="text-sm font-semibold text-theme-primary hover:underline"
            >
              Daily Challenge
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}

function HomePlayChoice({
  eyebrow,
  title,
  href,
  variant,
  cta,
  onClick,
}: {
  eyebrow: string;
  title: string;
  href: string;
  variant: "current" | "era";
  cta: string;
  onClick: () => void;
}) {
  const accentClass =
    variant === "era" ? "home-play-card--era" : "home-play-card--current";

  return (
    <MobileSection
      className={`home-play-card flex min-h-0 flex-col items-center overflow-hidden text-center ${SPACING.cardPaddingMobile} ${accentClass}`}
    >
      <p
        className={`${TYPO.eyebrow} ${
          variant === "era" ? "text-accent-gold" : "text-theme-primary"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className={`mt-1.5 ${TYPO.homeModeTitle}`}>{title}</h2>

      <div className="mt-4 w-full max-w-xs">
        <GameButton variant={variant} href={href} onClick={onClick} size="sm">
          {cta}
        </GameButton>
      </div>
    </MobileSection>
  );
}
