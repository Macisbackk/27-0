"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getDailyChallengeAttemptUsed,
  getDailyChallengeHref,
  getDailyChallengeProgress,
  getDailyChallengeScenario,
  type DailyChallengeScenario,
} from "@/lib/daily-challenge";
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
            New · Super League &amp; Championship
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
            Rugby League Manager Mode
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-300">
            Take charge of a real club. Play each round in a tap, chase promotion or the Grand Final, and unlock legends.
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
          blurb="Spin real 2026 squads, build a 13 and chase 27-0."
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
          blurb="Every Super League era, legends included."
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

      <div className={`mt-3 grid gap-3 sm:mt-4 sm:gap-4 ${SHOW_DAILY_CHALLENGE_UI ? "grid-cols-2" : ""}`}>
        {SHOW_DAILY_CHALLENGE_UI ? <HomeDailyCard /> : null}
        <Link
          href="/mini-games"
          onClick={() => playUiClick()}
          className="btn-press flex flex-col items-center justify-between gap-2 rounded-2xl border border-white/10 bg-pitch-900/70 p-4 text-center transition hover:border-theme-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60"
        >
          <span className={`${TYPO.eyebrow} text-theme-primary`}>Quick games</span>
          <span className="font-display text-lg font-black leading-tight text-white">Puzzles</span>
          <span aria-hidden className="flex gap-1">
            {["?", "W"].map((g) => (
              <span key={g} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-pitch-950 text-xs font-black text-gray-300">
                {g}
              </span>
            ))}
          </span>
          <span className="text-xs text-gray-400">Millionaire · Wordle</span>
        </Link>
      </div>
    </section>
  );
}

/** Today's Daily Challenge, filled in after mount (the date is the player's, not the server's). */
function HomeDailyCard() {
  const [today, setToday] = useState<{ scenario: DailyChallengeScenario; done: boolean; attemptUsed: boolean } | null>(null);
  useEffect(() => {
    const progress = getDailyChallengeProgress();
    setToday({
      scenario: getDailyChallengeScenario(),
      done: Boolean(progress.leagueLeaders && progress.playoffTitle),
      attemptUsed: getDailyChallengeAttemptUsed(),
    });
  }, []);
  const scenario = today?.scenario;
  return (
    <Link
      href={getDailyChallengeHref()}
      onClick={() => playUiClick()}
      className="btn-press flex flex-col items-center justify-between gap-2 rounded-2xl border border-accent-gold/30 bg-gradient-to-b from-accent-gold/10 to-pitch-950 p-4 text-center transition hover:border-accent-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60"
    >
      <span className={`${TYPO.eyebrow} text-accent-gold`}>
        Daily{scenario?.eraMode ? " · Era" : ""}
      </span>
      <span className="font-display text-lg font-black leading-tight text-white">Daily Challenge</span>
      <span className="min-h-[2.5rem] text-xs leading-snug text-gray-300">
        {scenario ? `Every opponent is ${scenario.forceOpponentClub}` : "A new challenge every day"}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          today?.done
            ? "bg-emerald-500/15 text-emerald-300"
            : today?.attemptUsed
              ? "bg-white/10 text-gray-300"
              : "bg-accent-gold/15 text-accent-gold"
        }`}
      >
        {today?.done ? "✓ Done today" : today?.attemptUsed ? "Attempt used · practice only" : "1 attempt today"}
      </span>
    </Link>
  );
}

function HomePlayChoice({
  eyebrow,
  title,
  blurb,
  href,
  variant,
  cta,
  onClick,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
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
      <p className="mt-1 text-sm text-gray-400">{blurb}</p>

      <div className="mt-4 w-full max-w-xs">
        <GameButton variant={variant} href={href} onClick={onClick} size="sm">
          {cta}
        </GameButton>
      </div>
    </MobileSection>
  );
}
