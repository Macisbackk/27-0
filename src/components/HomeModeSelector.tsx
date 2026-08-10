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
import {
  getDailyChallengeBestStreak,
  getDailyChallengeHref,
  getDailyChallengeProgress,
  getDailyChallengeScenario,
  getDailyChallengeStreak,
  hasClaimedDailyChallengeBonus,
} from "@/lib/daily-challenge";
import { formatClubFundsExact } from "@/lib/club-funds";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyProgress, setDailyProgress] = useState({
    leagueLeaders: false,
    playoffTitle: false,
  });
  const [dailyStreak, setDailyStreak] = useState(0);
  const [dailyBestStreak, setDailyBestStreak] = useState(0);
  const [scenario, setScenario] = useState(() => getDailyChallengeScenario());

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    setMounted(true);
    setScenario(getDailyChallengeScenario());
    setDailyClaimed(hasClaimedDailyChallengeBonus());
    setDailyProgress({
      leagueLeaders: Boolean(getDailyChallengeProgress().leagueLeaders),
      playoffTitle: Boolean(getDailyChallengeProgress().playoffTitle),
    });
    setDailyStreak(getDailyChallengeStreak());
    setDailyBestStreak(getDailyChallengeBestStreak());

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
            Manage a club. Win trophies.
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
            Draft 17. Play the season.
          </p>

          <div className="mt-4 flex w-full justify-center">
            <ChallengeCupVariantToggle
              sectionLabel="Pool"
              useShortLabels
              eraMode={normalEraMode}
              onEraModeChange={handleEraModeChange}
            />
          </div>

          <p className={`mx-auto mt-3 max-w-md text-center ${TYPO.meta}`}>
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

        <MobileSection className="flex w-full flex-col items-center text-center">
          <p className={`w-full text-center ${TYPO.keyLabel}`}>Daily</p>
          <h2 className={`mt-1 w-full text-center ${TYPO.homeModeTitle}`}>
            Daily challenge
          </h2>
          {mounted ? (
            <>
              <p
                className={`mx-auto mt-1 max-w-md text-center ${TYPO.keyLabel} text-pitch-400`}
              >
                {scenario.eraMode ? "Era" : "Current"}
              </p>
              <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.bodySm}`}>
                All {scenario.forceOpponentClub}
              </p>
              <p className={`mx-auto mt-1 max-w-md text-center ${TYPO.meta}`}>
                {scenario.blurb}
              </p>
              <p className={`mx-auto mt-1 max-w-md text-center ${TYPO.meta}`}>
                {formatClubFundsExact(scenario.leagueLeadersBonus)} League
                Leaders
                {" · "}
                {formatClubFundsExact(scenario.playoffTitleBonus)} Grand Final
              </p>
              {(dailyStreak > 0 || dailyBestStreak > 0) && (
                <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.meta}`}>
                  Streak {dailyStreak}
                  {dailyBestStreak > dailyStreak
                    ? ` · Best ${dailyBestStreak}`
                    : null}
                </p>
              )}
              <p className={`mx-auto mt-1 max-w-md text-center ${TYPO.meta}`}>
                <a
                  href="/leaderboard?tracker=daily_streak"
                  className="text-theme-primary underline-offset-2 hover:underline"
                  onClick={() => playUiClick()}
                >
                  Daily streak leaderboard
                </a>
              </p>
              {dailyClaimed ? (
                <p className={`mt-3 ${TYPO.meta} text-theme-primary`}>
                  Done today
                </p>
              ) : (
                <div className="mt-4 flex w-full justify-center">
                  <GameButton
                    variant="secondary"
                    href={getDailyChallengeHref()}
                    onClick={() => playUiClick()}
                    className="max-w-sm"
                  >
                    {dailyProgress.leagueLeaders
                      ? "Finish the Grand Final"
                      : "Play daily challenge"}
                  </GameButton>
                </div>
              )}
            </>
          ) : (
            <p className={`mx-auto mt-2 max-w-md text-center ${TYPO.meta}`}>
              Loading today&apos;s challenge…
            </p>
          )}
        </MobileSection>
      </div>
    </div>
  );
}
