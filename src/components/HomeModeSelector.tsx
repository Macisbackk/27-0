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
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="play-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p id="play-heading" className={TYPO.keyLabel}>
          Main Modes
        </p>
        <h2 className={`mt-1.5 sm:mt-2 ${TYPO.pageTitle}`}>
          Choose your Super League path
        </h2>
        <p className={`mx-auto mt-2 hidden max-w-2xl sm:mt-3 sm:block ${TYPO.pageSubtitle}`}>
          Start in the modern game or step into classic seasons. Both modes let you
          build a 17, chase silverware, and push for a 27-0 run.
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
        <HomePlayChoice
          eyebrow="Current squads"
          title="Normal Mode"
          description="Build from the current player pool and try to dominate the league and playoffs."
          href={buildPlayHref("classic", false)}
          bullets={["Current-era squads", "Quick team build", "League + playoffs"]}
          stats={[
            { label: "Pool", value: "Current" },
            { label: "Style", value: "Fast start" },
            { label: "Aim", value: "Win it all" },
          ]}
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
          description="Draft from legendary seasons and build a dream team from rugby league history."
          href={buildPlayHref("classic", true)}
          bullets={["Historic players", "Era team pools", "Legends and classics"]}
          stats={[
            { label: "Pool", value: "Historic" },
            { label: "Style", value: "Legend build" },
            { label: "Aim", value: "Rewrite eras" },
          ]}
          variant="era"
          cta="Play Era"
          onClick={() => {
            setNormalEraVariant(true);
            playUiClick();
            playModeClassicStart("NORMAL");
          }}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-3">
        <HomeInfoTile
          title="Mini Games"
          body="Quiz, Wordle, Hangman, and Higher or Lower when you want a faster session."
          href="/mini-games"
        />
        <HomeInfoTile
          title="Coach Profile"
          body="Track achievements, stats, and your best runs across modes."
          href="/profile#achievements"
        />
        <HomeInfoTile
          title="Leaderboard"
          body="See how your seasons stack up against other coaches."
          href="/leaderboard"
        />
      </div>
    </section>
  );
}

function HomePlayChoice({
  eyebrow,
  title,
  description,
  href,
  bullets,
  stats,
  variant,
  cta,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  bullets: string[];
  stats: { label: string; value: string }[];
  variant: "current" | "era";
  cta: string;
  onClick: () => void;
}) {
  const accentClass =
    variant === "era"
      ? "border-accent-gold/35 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.22),transparent_38%),linear-gradient(180deg,rgba(40,31,8,0.95),rgba(13,17,14,0.98))] shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
      : "border-theme-primary/30 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_38%),linear-gradient(180deg,rgba(7,25,20,0.95),rgba(13,17,14,0.98))] shadow-[0_20px_45px_rgba(0,0,0,0.28)]";

  return (
    <MobileSection
      className={`min-h-0 overflow-hidden p-3.5 text-left sm:p-5 ${accentClass}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
              variant === "era" ? "text-accent-gold" : "text-theme-primary"
            }`}
          >
            {eyebrow}
          </p>
          <h2 className={TYPO.homeModeTitle}>{title}</h2>
          <p className={`mt-1 ${TYPO.bodySm}`}>{description}</p>
        </div>
        <div
          className={`hidden rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline-flex ${
            variant === "era"
              ? "border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
              : "border border-theme-primary/25 bg-theme-primary/10 text-theme-primary"
          }`}
        >
          Featured
        </div>
      </div>

      <div className="mt-3 hidden grid-cols-3 gap-2 sm:mt-4 sm:grid">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {stat.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-white sm:text-sm">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <ul className="mt-3 hidden gap-2 sm:mt-4 sm:grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-xs font-medium text-gray-200"
          >
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row">
        <GameButton
          variant={variant}
          href={href}
          onClick={onClick}
          size="sm"
          className="sm:flex-1"
        >
          {cta}
        </GameButton>
        <div className="hidden sm:block sm:flex-1">
          <GameButton
            variant="secondary"
            href="/showcase"
            onClick={() => playUiClick()}
            size="sm"
          >
            View players
          </GameButton>
        </div>
      </div>
    </MobileSection>
  );
}

function HomeInfoTile({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <MobileSection className="border-white/10 bg-[linear-gradient(180deg,rgba(17,24,22,0.96),rgba(11,15,14,0.98))] p-3.5 text-left sm:p-5">
      <p className={TYPO.sectionTitle}>{title}</p>
      <p className={`mt-2 ${TYPO.bodySm}`}>{body}</p>
      <Link
        href={href}
        onClick={() => playUiClick()}
        className="mt-3 inline-flex text-sm font-semibold text-theme-primary hover:underline"
      >
        Open
      </Link>
    </MobileSection>
  );
}
