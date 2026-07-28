"use client";

import { useEffect, useState } from "react";
import { GameBadge } from "@/components/ui/GameBadge";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
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
        <GamePanel variant="featured" padded className={`${SPACING.cardPaddingLg}`}>
          <div className="flex flex-wrap items-center gap-2">
            <GameBadge>Featured</GameBadge>
            <GameBadge tone="muted">Career</GameBadge>
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-pitch)] text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl">
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
        </GamePanel>

        <GamePanel variant="elevated" padded>
          <GameSectionTitle label="Quick modes" heading="Spin & simulate" />
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Build your XIII position by position and chase 27-0. Secondary to
            Manager Mode — faster sessions, same Super League feel.
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Squad pool"
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={handleEraModeChange}
            className="mt-4"
          />

          <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
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
