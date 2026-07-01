"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { buildPlayHref } from "@/lib/play-links";
import {
  getCupEraVariant,
  getNormalEraVariant,
  setCupEraVariant,
  setNormalEraVariant,
  CUP_ERA_VARIANT_CHANGED_EVENT,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import {
  playModeChallengeCupStart,
  playModeClassicStart,
  playUiClick,
} from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { ModeStartLink } from "./ModeStartLink";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [cupEraMode, setCupEraMode] = useState(false);
  const [quickModeOpen, setQuickModeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    setCupEraMode(getCupEraVariant());
    setMounted(true);

    const onNormal = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraMode(detail.eraMode);
    };
    const onCup = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setCupEraMode(detail.eraMode);
    };

    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormal);
    window.addEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onCup);
    return () => {
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormal);
      window.removeEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onCup);
    };
  }, []);

  const normalHref = mounted
    ? buildPlayHref("classic", normalEraMode)
    : "/play";
  const cupHref = mounted
    ? buildPlayHref("cup", cupEraMode)
    : "/play?cup=1";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className={`mx-auto flex max-w-xl flex-col gap-5`}>
        <div
          className={`group w-full ${SPACING.cardPaddingLg} transition ${CARD.featured} ${CARD.glass} ${CARD.panel} border-theme-primary/30 hover:border-theme-primary/50`}
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
          className={`w-full ${SPACING.cardPaddingLg} transition ${CARD.glass} ${CARD.panel} ${CARD.featured}`}
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
                Draft & Simulate
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
            <div className={`mt-5 flex flex-col gap-5 border-t border-pitch-700/50 pt-5`}>
              <ModePanel title="Current Mode" eraActive={normalEraMode}>
                <p className={TYPO.body}>
                  Draft your XIII position by position and simulate a full Super
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

              <ModePanel title="Challenge Cup" eraActive={cupEraMode}>
                <p className={TYPO.body}>
                  Draft your squad and battle through a knockout tournament — or
                  pick a historic club season and lead that era squad through the
                  draw.
                </p>

                <ChallengeCupVariantToggle
                  useShortLabels
                  eraMode={cupEraMode}
                  onEraModeChange={(era) => {
                    setCupEraMode(era);
                    setCupEraVariant(era);
                  }}
                  className="mt-5"
                />

                <ModeStartLink
                  href={cupHref}
                  eraMode={cupEraMode}
                  onClick={() => playModeChallengeCupStart()}
                  className="mt-5"
                >
                  {cupEraMode
                    ? "Start Era Challenge Cup →"
                    : "Start Challenge Cup →"}
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
  const cardAccent = eraActive
    ? "border border-accent-gold/25 shadow-[0_0_32px_rgba(251,191,36,0.08)] hover:border-accent-gold/35"
    : `${CARD.featured} hover:border-theme-tertiary/50`;

  const titleClass = eraActive ? "text-accent-gold" : "text-white";

  return (
    <div
      className={`group w-full ${SPACING.cardPadding} transition ${cardAccent} ${
        eraActive
          ? `${CARD.base} border border-accent-gold/30 bg-pitch-900/95`
          : `${CARD.glass} ${CARD.panel}`
      }`}
    >
      <h3 className={`${TYPO.cardTitle} ${titleClass}`}>{title}</h3>
      {children}
    </div>
  );
}
