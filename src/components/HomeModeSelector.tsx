"use client";

import { useEffect, useState } from "react";
import { GameBadge } from "@/components/ui/GameBadge";
import { GameButton } from "@/components/ui/GameButton";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { buildPlayHref } from "@/lib/play-links";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { getQuickModeCurrentEraHint, getQuickSeasonStartLabel } from "@/lib/mode-labels";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { ModeStartLink } from "./ModeStartLink";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    setMounted(true);

    const onNormal = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraMode(detail.eraMode);
    };

    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormal);
    return () => {
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormal);
    };
  }, []);

  const handleEraModeChange = (era: boolean) => {
    setNormalEraMode(era);
    setNormalEraVariant(era);
  };

  const normalHref = mounted ? buildPlayHref("classic", normalEraMode) : "/play";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <ScoreboardPanel variant="featured" padded className={SPACING.cardPaddingLg}>
          <div className="flex flex-wrap items-center gap-2">
            <GameBadge>Main game</GameBadge>
            <GameBadge tone="muted">Career</GameBadge>
          </div>
          <p className="mt-3 font-display text-[0.625rem] font-bold uppercase tracking-[0.22em] text-theme-primary">
            Club office
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-pitch)] text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
            Manager Mode
          </h2>
          <p className={`mt-3 max-w-lg ${TYPO.body}`}>
            Take charge of a Super League club — contracts, reserves, tactics,
            transfers, and a full season on the board.
          </p>
          <div className="pitch-divider my-5" />
          <GameButton
            variant="theme"
            href="/manager"
            onClick={() => playUiClick()}
          >
            Enter the dugout
          </GameButton>
        </ScoreboardPanel>

        <div className="match-ticket">
          <p className="match-ticket__label">Matchday tickets · Quick modes</p>
          <GameSectionTitle label="Spin & simulate" heading="Quick Mode" />
          <p className={`mt-1 ${TYPO.bodySm}`}>
            Build your XIII position by position and chase 27-0. Compact sessions —
            secondary to Manager Mode.
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Squad pool"
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={handleEraModeChange}
            className="mt-3"
          />

          <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
            {getQuickModeCurrentEraHint(normalEraMode)}
          </p>

          <div className="mt-3">
            <ModeStartLink
              href={normalHref}
              eraMode={normalEraMode}
              onClick={() => {
                playUiClick();
                playModeClassicStart("NORMAL");
              }}
            >
              {getQuickSeasonStartLabel(normalEraMode)}
            </ModeStartLink>
          </div>
        </div>
      </div>
    </div>
  );
}
