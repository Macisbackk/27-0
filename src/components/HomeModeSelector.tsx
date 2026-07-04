"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { buildPlayHref } from "@/lib/play-links";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { getQuickModeCurrentEraHint, getQuickSeasonLabel, getQuickSeasonStartLabel } from "@/lib/mode-labels";
import { playModeClassicStart, playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { ModeStartLink } from "./ModeStartLink";

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

interface QuickModePanelProps {
  normalEraMode: boolean;
  normalHref: string;
  onEraModeChange: (era: boolean) => void;
}

function QuickModePanel({
  normalEraMode,
  normalHref,
  onEraModeChange,
}: QuickModePanelProps) {
  return (
    <ModePanel title={getQuickSeasonLabel(normalEraMode)} eraActive={normalEraMode}>
      <p className={TYPO.body}>
        Build your XIII position by position and simulate a full Super League
        campaign. Can you go 27-0?
      </p>

      <ChallengeCupVariantToggle
        sectionLabel="Squad pool"
        useShortLabels
        eraMode={normalEraMode}
        onEraModeChange={onEraModeChange}
        className="mt-5"
      />

      <p className={`mt-3 ${TYPO.bodySm} text-gray-500`}>
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
    </ModePanel>
  );
}

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    setMobileExpanded(isMobileViewport());
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              className="flex w-full flex-1 items-start justify-between gap-4 text-left sm:pointer-events-none"
              onClick={() => {
                playUiClick();
                setMobileExpanded((open) => !open);
              }}
              aria-expanded={mobileExpanded}
              aria-controls="quick-mode-panel-mobile"
            >
              <div>
                <p className={TYPO.sectionLabel}>Quick Mode</p>
                <h2 className={`${TYPO.cardTitle} mt-1 text-2xl text-white`}>
                  Spin & Simulate
                </h2>
                <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
                  Build your XIII and chase 27-0.
                  {mounted && normalEraMode ? (
                    <span className="mt-1 block text-accent-gold">
                      Era squads selected
                    </span>
                  ) : null}
                </p>
              </div>
              <span
                className={`mt-1 shrink-0 text-sm text-theme-primary transition sm:hidden ${
                  mobileExpanded ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            <ModeStartLink
              href={normalHref}
              eraMode={normalEraMode}
              onClick={() => {
                playUiClick();
                playModeClassicStart("NORMAL");
              }}
              className="hidden shrink-0 !w-auto sm:mt-1 sm:inline-flex"
            >
              {getQuickSeasonStartLabel(normalEraMode)}
            </ModeStartLink>
          </div>

          <div
            className={`mt-5 hidden flex-col gap-5 border-t border-pitch-700/50 pt-5 sm:flex`}
          >
            <QuickModePanel
              normalEraMode={normalEraMode}
              normalHref={normalHref}
              onEraModeChange={handleEraModeChange}
            />
          </div>

          {mobileExpanded ? (
            <div
              id="quick-mode-panel-mobile"
              className={`mt-5 flex flex-col gap-5 border-t border-pitch-700/50 pt-5 sm:hidden`}
            >
              <QuickModePanel
                normalEraMode={normalEraMode}
                normalHref={normalHref}
                onEraModeChange={handleEraModeChange}
              />
            </div>
          ) : null}
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
