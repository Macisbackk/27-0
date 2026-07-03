"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { buildPlayHref } from "@/lib/play-links";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { ModeStartLink } from "./ModeStartLink";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [quickModeOpen, setQuickModeOpen] = useState(false);
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

  const normalHref = mounted ? buildPlayHref("classic", normalEraMode) : "/play";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className={`mx-auto flex max-w-xl flex-col gap-5`}>
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
          className={`w-full ${SPACING.cardPaddingLg} transition ${CARD.hero} ${CARD.featured}`}
        >
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 text-left"
            onClick={() => {
              playUiClick();
              setQuickModeOpen((open) => !open);
            }}
          >
            <div>
              <p className={TYPO.sectionLabel}>Quick Mode</p>
              <h2 className={`${TYPO.cardTitle} mt-1 text-2xl text-white`}>
                Spin & Simulate
              </h2>
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
                Fast squad-building campaigns — current squads or historic era
                teams.
              </p>
            </div>
            <span
              className={`mt-1 shrink-0 text-sm text-theme-primary transition ${
                quickModeOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            >
              ▼
            </span>
          </button>

          {quickModeOpen && (
            <div
              className={`mt-5 flex flex-col gap-5 border-t border-pitch-700/50 pt-5`}
            >
              <ModePanel title="Current Mode" eraActive={normalEraMode}>
                <p className={TYPO.body}>
                  Build your XIII position by position and simulate a full Super
                  League campaign. Can you go 27-0?
                </p>

                <ChallengeCupVariantToggle
                  sectionLabel="Mode"
                  useShortLabels
                  eraMode={normalEraMode}
                  onEraModeChange={(era) => {
                    setNormalEraMode(era);
                    setNormalEraVariant(era);
                  }}
                  className="mt-5"
                />

                {normalEraMode ? (
                  <p className={`mt-3 ${TYPO.bodySm} text-gray-500`}>
                    Historic Super League team-years with club + year spins — no
                    2026 squads.
                  </p>
                ) : (
                  <p className={`mt-3 ${TYPO.bodySm} text-gray-500`}>
                    2026 current squads only — club spins with no year label.
                  </p>
                )}

                <ModeStartLink
                  href={normalHref}
                  eraMode={normalEraMode}
                  onClick={() => {
                    playUiClick();
                    playModeClassicStart("NORMAL");
                  }}
                  className="mt-5"
                >
                  {normalEraMode ? "Start Era Mode →" : "Start Current Mode →"}
                </ModeStartLink>
              </ModePanel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModePanel({
  title,
  eraActive = false,
  children,
}: {
  title: string;
  eraActive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`${SPACING.cardPadding} ${CARD.base} ${
        eraActive ? "border-accent-gold/35" : "border-pitch-700/50"
      }`}
    >
      <h3 className={`${TYPO.cardTitle} text-white`}>{title}</h3>
      {children}
    </div>
  );
}
