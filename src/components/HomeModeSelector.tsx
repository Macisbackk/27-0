"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileSection } from "@/components/ui/MobileLayout";
import { buildPlayHref } from "@/lib/play-links";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import {
  getQuickModeCurrentEraHint,
  getQuickSeasonStartLabel,
} from "@/lib/mode-labels";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
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

      <div className="mx-auto flex max-w-xl flex-col gap-[var(--mobile-section-gap)]">
        <MobileSection className="text-left sm:text-left">
          <p className={TYPO.keyLabel}>Career</p>
          <h2 className={`mt-1 ${TYPO.homeModeTitle}`}>Manager Mode</h2>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Build a club, manage the season, chase trophies.
          </p>
          <div className="mt-4">
            <GameButton
              variant="theme"
              href="/manager"
              onClick={() => playUiClick()}
            >
              Enter Manager Mode
            </GameButton>
          </div>
        </MobileSection>

        <div className="border-t border-[var(--mobile-divider)] pt-[var(--mobile-section-gap)]">
          <p className={TYPO.keyLabel}>Quick Mode</p>
          <h2 className={`mt-1 ${TYPO.homeModeTitle}`}>Draft &amp; go 27-0</h2>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Spin a 17 from Current or Era pools and run the season.
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Pool"
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={handleEraModeChange}
            className="mt-4"
          />

          <p className={`mt-3 ${TYPO.meta}`}>
            {normalEraMode
              ? "Ratings reflect how each player performed in that season."
              : "Ratings reflect this season’s performances."}
          </p>
          <p className={`mt-1 ${TYPO.meta}`}>
            {getQuickModeCurrentEraHint(normalEraMode)}
          </p>

          <div className="mt-4">
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
