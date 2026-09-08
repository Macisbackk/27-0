"use client";

import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { buildPlayHref } from "@/lib/play-links";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

export function HomeModeSelector() {
  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="play-heading">
      <p id="play-heading" className={`mb-3 text-center ${TYPO.keyLabel}`}>Play</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <HomePlayChoice
          title="Quick Mode"
          description="Build your team and play."
          href={buildPlayHref("classic", false)}
          onClick={() => {
            setNormalEraVariant(false);
            playUiClick();
            playModeClassicStart("NORMAL");
          }}
        />
        <HomePlayChoice
          title="Era Mode"
          description="Play with historic teams."
          href={buildPlayHref("classic", true)}
          onClick={() => {
            setNormalEraVariant(true);
            playUiClick();
            playModeClassicStart("NORMAL");
          }}
        />
        <HomePlayChoice
          title="Mini Games"
          description="Quiz · Wordle · Hangman · Higher or Lower"
          href="/mini-games"
          onClick={() => playUiClick()}
          accent
        />
      </div>
    </section>
  );
}

function HomePlayChoice({
  title,
  description,
  href,
  onClick,
  accent = false,
}: {
  title: string;
  description: string;
  href: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <MobileSection className="grid min-h-0 grid-cols-[1fr_auto] items-center gap-3 p-4 text-left sm:flex sm:min-h-44 sm:flex-col sm:justify-center sm:p-5 sm:text-center">
      <div className="min-w-0">
        <h2 className={TYPO.homeModeTitle}>{title}</h2>
        <p className={`mt-1 ${TYPO.bodySm}`}>{description}</p>
      </div>
      <GameButton
        variant={accent ? "theme" : "secondary"}
        href={href}
        onClick={onClick}
        size="sm"
        fullWidth={false}
        className="shrink-0 sm:mt-2"
      >
        Play
      </GameButton>
    </MobileSection>
  );
}
