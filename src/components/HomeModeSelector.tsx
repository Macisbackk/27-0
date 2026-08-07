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
import { UI_COPY } from "@/lib/ui/copy";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { ModeStartLink } from "./ModeStartLink";
import {
  DAILY_CHALLENGE_BONUS,
  getDailyChallengeHref,
  hasClaimedDailyChallengeBonus,
} from "@/lib/daily-challenge";
import { formatClubFundsExact } from "@/lib/club-funds";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    setMounted(true);
    setDailyClaimed(hasClaimedDailyChallengeBonus());

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
    <div className="mx-auto w-full max-w-xl text-center">
      <GuestNotice variant="home" />

      <div className="flex flex-col items-center gap-[var(--mobile-section-gap)]">
        <MobileSection className="flex w-full flex-col items-center text-center">
          <p className={`w-full text-center ${TYPO.keyLabel}`}>Career</p>
          <h2 className={`mt-1 w-full text-center ${TYPO.homeModeTitle}`}>
            Manager Mode
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.bodySm}`}>
            Build a club, manage the season, chase trophies.
          </p>
          <div className="mt-4 flex w-full justify-center">
            <GameButton
              variant="theme"
              href="/manager"
              onClick={() => playUiClick()}
              className="max-w-sm"
            >
              Enter Manager Mode
            </GameButton>
          </div>
        </MobileSection>

        <MobileSection className="flex w-full flex-col items-center text-center">
          <p className={`w-full text-center ${TYPO.keyLabel}`}>Quick Mode</p>
          <h2 className={`mt-1 w-full text-center ${TYPO.homeModeTitle}`}>
            Draft &amp; go 27-0
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.bodySm}`}>
            Spin a 17 from Current or Era pools and run the season.
          </p>

          <div className="mt-3 w-full rounded-xl border border-theme-primary/25 bg-theme-primary/5 px-3 py-2.5 text-center">
            <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-theme-primary`}>
              Daily challenge
            </p>
            <p className={`mt-1 ${TYPO.bodySm}`}>
              Finish a Classic Quick Mode season today for a{" "}
              {formatClubFundsExact(DAILY_CHALLENGE_BONUS)} Club Funds bonus.
            </p>
            {dailyClaimed ? (
              <p className={`mt-1 ${TYPO.meta} text-theme-primary`}>Bonus claimed today</p>
            ) : (
              <div className="mt-2 flex justify-center">
                <GameButton
                  variant="secondary"
                  size="sm"
                  href={getDailyChallengeHref()}
                  onClick={() => playUiClick()}
                >
                  Play today&apos;s challenge
                </GameButton>
              </div>
            )}
          </div>

          <div className="mt-4 flex w-full justify-center">
            <ChallengeCupVariantToggle
              sectionLabel="Pool"
              useShortLabels
              eraMode={normalEraMode}
              onEraModeChange={handleEraModeChange}
            />
          </div>

          <p
            className={`mx-auto mt-3 max-w-md text-center ${TYPO.meta} mobile-safe-text`}
          >
            {normalEraMode
              ? UI_COPY.eraRatingNote
              : UI_COPY.currentRatingNote}
          </p>
          <p className={`mx-auto mt-1 max-w-md text-center ${TYPO.meta}`}>
            {getQuickModeCurrentEraHint(normalEraMode)}
          </p>

          <div className="mt-4 flex w-full justify-center">
            <div className="w-full max-w-sm">
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
        </MobileSection>
      </div>
    </div>
  );
}
