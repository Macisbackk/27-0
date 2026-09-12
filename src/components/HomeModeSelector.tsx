"use client";

import Link from "next/link";
import { getDailyChallengeHref } from "@/lib/daily-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { buildPlayHref } from "@/lib/play-links";
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

      {/* Featured: Manager Mode */}
      <div className="mt-3 sm:mt-4">
        <MobileSection className="home-play-card flex min-h-0 flex-col items-center overflow-hidden text-center border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-pitch-900/60 to-pitch-950 p-5 sm:p-6 shadow-xl">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30">
            Full Career Simulation
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
            Rugby League Manager Mode
          </h2>
          <p className="mt-2 max-w-xl text-xs sm:text-sm text-pitch-300 leading-relaxed">
            Take control of a Super League or Championship club. Scout, negotiate transfers, manage
            contracts &amp; salary cap, develop academy prospects, and fight for promotion and silverware.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3 w-full max-w-sm">
            <GameButton
              variant="current"
              href="/manager"
              onClick={() => playUiClick()}
              size="md"
              className="w-full sm:w-auto px-8 py-2.5 font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg hover:brightness-110"
            >
              Play Manager Mode →
            </GameButton>
          </div>
        </MobileSection>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <HomePlayChoice
          eyebrow="Current squads · 2026"
          title="Classic"
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
          title="Era Classic"
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
              href={getDailyChallengeHref()}
              onClick={() => {
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
