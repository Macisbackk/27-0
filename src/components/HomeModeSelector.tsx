"use client";

import Link from "next/link";
import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { buildPlayHref } from "@/lib/play-links";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

export function HomeModeSelector() {
  return (
    <section className="mx-auto w-full max-w-4xl text-center" aria-labelledby="play-heading">
      <p id="play-heading" className={TYPO.keyLabel}>
        Play
      </p>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <HomePlayChoice
          eyebrow="Current squads"
          title="Normal Mode"
          description="Build from today's Super League pool."
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
          title="Era Mode"
          description="Draft legends from classic seasons."
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
      </p>
    </section>
  );
}

function HomePlayChoice({
  eyebrow,
  title,
  description,
  href,
  variant,
  cta,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  variant: "current" | "era";
  cta: string;
  onClick: () => void;
}) {
  const accentClass =
    variant === "era"
      ? "border-accent-gold/35 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_42%),linear-gradient(180deg,rgba(40,31,8,0.95),rgba(13,17,14,0.98))]"
      : "border-theme-primary/30 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_42%),linear-gradient(180deg,rgba(7,25,20,0.95),rgba(13,17,14,0.98))]";

  return (
    <MobileSection
      className={`flex min-h-0 flex-col items-center overflow-hidden p-4 text-center sm:p-6 ${accentClass}`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
          variant === "era" ? "text-accent-gold" : "text-theme-primary"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className={`mt-1.5 ${TYPO.homeModeTitle}`}>{title}</h2>
      <p className={`mx-auto mt-1.5 max-w-sm ${TYPO.bodySm}`}>{description}</p>

      <div className="mt-4 w-full max-w-xs">
        <GameButton variant={variant} href={href} onClick={onClick} size="sm">
          {cta}
        </GameButton>
      </div>
    </MobileSection>
  );
}
