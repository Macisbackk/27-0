"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
import {
  BTN,
  CARD,
  NORMAL,
  SPACING,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { EraStartLink } from "./EraStartLink";
import { ModeStartLink } from "./ModeStartLink";

export function HomeModeSelector() {
  const [normalEraMode, setNormalEraMode] = useState(false);
  const [cupEraMode, setCupEraMode] = useState(false);
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
        <ModePanel title="Normal Mode" eraActive={normalEraMode}>
          <p className={TYPO.body}>
            Draft your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <ChallengeCupVariantToggle
            sectionLabel="Mode"
            eraMode={normalEraMode}
            onEraModeChange={(era) => {
              setNormalEraMode(era);
              setNormalEraVariant(era);
            }}
            className="mt-5"
          />

          {normalEraMode ? (
            <p className={`mt-3 ${TYPO.bodySm} text-gray-500`}>
              Historic Super League team-years with club + year spins. Current
              2026 squads appear less often.
            </p>
          ) : (
            <p className={`mt-3 ${TYPO.bodySm} text-gray-500`}>
              2026 current squads only — club spins with no year label.
            </p>
          )}

          <ModeStartLink
            href={normalHref}
            onClick={() => {
              playUiClick();
              playModeClassicStart("NORMAL");
            }}
            className="mt-5"
          >
            {normalEraMode ? "Start Era Mode" : "Start Current Mode"} →
          </ModeStartLink>
        </ModePanel>

        <ModePanel
          title="Challenge Cup"
          eraActive={cupEraMode}
          cupCurrent={!cupEraMode}
        >
          <p className={TYPO.body}>
            Draft your squad and battle through a knockout tournament — or pick
            a historic club season and lead that era squad through the draw.
          </p>

          <ChallengeCupVariantToggle
            eraMode={cupEraMode}
            onEraModeChange={(era) => {
              setCupEraMode(era);
              setCupEraVariant(era);
            }}
            className="mt-5"
          />

          {cupEraMode ? (
            <EraStartLink
              href={cupHref}
              onClick={() => playModeChallengeCupStart()}
              className="mt-5"
            >
              Start Era Challenge Cup →
            </EraStartLink>
          ) : (
            <Link
              href={cupHref}
              onClick={() => playModeChallengeCupStart()}
              className={`mt-5 block w-full btn-press text-center ${BTN.primaryLg}`}
            >
              Start Challenge Cup →
            </Link>
          )}
        </ModePanel>
      </div>
    </div>
  );
}

function ModePanel({
  title,
  eraActive = false,
  cupCurrent = false,
  children,
}: {
  title: string;
  eraActive?: boolean;
  cupCurrent?: boolean;
  children: ReactNode;
}) {
  const cardAccent = eraActive
    ? "border border-accent-gold/25 shadow-[0_0_32px_rgba(251,191,36,0.08)] hover:border-accent-gold/35"
    : cupCurrent
      ? `${CARD.featured} ${NORMAL.modeCardHover}`
      : `${CARD.featured} ${NORMAL.modeCardHover}`;

  const titleClass = eraActive ? "text-accent-gold" : "text-white";

  return (
    <div
      className={`group w-full ${SPACING.cardPaddingLg} transition ${cardAccent} ${
        eraActive
          ? `${CARD.base} border border-accent-gold/30 bg-pitch-900/95`
          : `${CARD.glass} ${CARD.panel}`
      }`}
    >
      <h2 className={`${TYPO.cardTitle} ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}
