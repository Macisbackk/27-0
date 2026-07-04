"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { buildPlayHref } from "@/lib/play-links";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { getQuickModeCurrentEraHint, getQuickSeasonStartLabel } from "@/lib/mode-labels";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
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

      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <div
          className={`group w-full ${SPACING.cardPaddingLg} transition ${CARD.featured} ${CARD.hero} border-theme-primary/35 hover:border-theme-primary/55`}
        >
          <p className={TYPO.sectionLabel}>Main Mode</p>
          <h2 className={`${TYPO.cardTitle} mt-1 text-2xl text-white`}>
            Manager Mode
          </h2>
          <p className={`mt-3 ${TYPO.body}`}>
            Take charge of a Super League club, manage contracts, develop
            reserves, set tactics and play through the season.
          </p>
          <GameButton
            variant="theme"
            href="/manager"
            className="mt-5"
            onClick={() => playUiClick()}
          >
            Start Manager Mode
          </GameButton>
        </div>

        <div
          className={`w-full ${SPACING.cardPaddingLg} transition ${CARD.hero} ${CARD.featured} ${
            normalEraMode ? "border-accent-gold/35" : ""
          }`}
        >
          <p className={TYPO.sectionLabel}>Quick Mode</p>
          <h2 className={`${TYPO.cardTitle} mt-1 text-2xl text-white`}>
            Spin & Simulate
          </h2>
          <p className={`mt-3 ${TYPO.body}`}>
            Build your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Squad pool"
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={handleEraModeChange}
            className="mt-5"
          />

          <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
            {getQuickModeCurrentEraHint(normalEraMode)}
          </p>

          <ModeStartLink
            href={normalHref}
            eraMode={normalEraMode}
            onClick={() => {
              playUiClick();
              playModeClassicStart("NORMAL");
            }}
            className="mt-5"
          >
            {getQuickSeasonStartLabel(normalEraMode)}
          </ModeStartLink>
        </div>
      </div>
    </div>
  );
}
