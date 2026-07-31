"use client";

import { useEffect, useState } from "react";
import { GameBadge } from "@/components/ui/GameBadge";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
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
        <GamePanel surface="scoreboard" variant="featured" padded className={SPACING.cardPaddingLg}>
          <div className="flex flex-wrap items-center gap-2">
            <GameBadge>Featured</GameBadge>
            <GameBadge tone="muted">Career</GameBadge>
          </div>
          <h2 className={`mt-3 ${TYPO.homeModeTitle}`}>Manager Mode</h2>
          <p className={TYPO.homeModeBody}>
            Take charge of a Super League club. Build your squad, handle
            contracts, develop reserves, manage transfers and chase trophies
            across multiple seasons.
          </p>
          <div className="pitch-divider my-5" />
          <GameButton
            variant="theme"
            href="/manager"
            onClick={() => playUiClick()}
          >
            Enter Manager Mode
          </GameButton>
        </GamePanel>

        <GamePanel variant="elevated" padded>
          <p className={TYPO.sectionLabel}>Quick play</p>
          <h2 className={`mt-1 ${TYPO.homeModeTitle}`}>Normal Mode</h2>
          <p className={TYPO.homeModeBody}>
            Draft a 17 from Current or Era pools and try to build a side good
            enough to go 27-0.
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Squad pool"
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={handleEraModeChange}
            className="mt-4"
          />

          <p className={`mt-3 text-center ${TYPO.bodySm}`}>
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
        </GamePanel>
      </div>
    </div>
  );
}
