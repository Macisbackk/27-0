"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { GameDifficulty } from "@/lib/types";
import { buildPlayHref } from "@/lib/play-links";
import {
  getHardModeEnabled,
  HARD_MODE_CHANGED_EVENT,
  setHardModeEnabled,
} from "@/lib/storage/preferences";
import {
  playHardModeOff,
  playHardModeOn,
  playModeChallengeCupStart,
  playUiClick,
} from "@/lib/sound";
import {
  BTN,
  CARD,
  HARD,
  NORMAL,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";

export function HomeModeSelector() {
  const [difficulty, setDifficulty] = useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDifficulty(getHardModeEnabled() ? "HARD" : "NORMAL");
    setMounted(true);

    const sync = (event: Event) => {
      const detail = (event as CustomEvent<GameDifficulty>).detail;
      if (detail) {
        setDifficulty(detail);
        return;
      }
      setDifficulty(getHardModeEnabled() ? "HARD" : "NORMAL");
    };

    window.addEventListener(HARD_MODE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(HARD_MODE_CHANGED_EVENT, sync);
  }, []);

  const updateDifficulty = (next: GameDifficulty) => {
    if (next === "HARD" && difficulty !== "HARD") playHardModeOn();
    if (next === "NORMAL" && difficulty === "HARD") playHardModeOff();
    setDifficulty(next);
    setHardModeEnabled(next === "HARD");
  };

  const classicHref = mounted ? buildPlayHref("classic", difficulty) : "/play";
  const draftHref = mounted
    ? buildPlayHref("draft", difficulty)
    : "/play?draft=1";
  const isHard = difficulty === "HARD";
  const classicAction = isHard ? "Start Hard Season" : "Start Season";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className={`mx-auto flex max-w-xl flex-col gap-5`}>
        <ModePanel title="Normal Mode" hardActive={isHard}>
          <p className={TYPO.body}>
            Draft your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Difficulty</p>
            <div className={tabGroupClass(isHard, !isHard)}>
              <button
                type="button"
                onClick={() => updateDifficulty("NORMAL")}
                className={tabGroupButtonClass(!isHard, "normal")}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => updateDifficulty("HARD")}
                className={tabGroupButtonClass(isHard, "hard")}
              >
                Hard
              </button>
            </div>
            {isHard && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-red-400`}>
                Ratings and values hidden until season review. No rerolls.
              </p>
            )}
          </div>

          <Link
            href={classicHref}
            onClick={() => playUiClick()}
            className={`mt-5 w-full ${BTN.base} ${isHard ? BTN.primaryHard : BTN.primary}`}
          >
            {classicAction} →
          </Link>
        </ModePanel>

        <ModePanel title="Draft Mode" hardActive={isHard}>
          <p className={TYPO.body}>
            Pick players from pairs, then place them in any empty slot. Natural
            positions carry no penalty; out-of-position placements cost 5 OVR.
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Draft Type</p>
            <div className={tabGroupClass(isHard, !isHard)}>
              <button
                type="button"
                onClick={() => updateDifficulty("NORMAL")}
                className={tabGroupButtonClass(!isHard, "normal")}
              >
                Standard Draft
              </button>
              <button
                type="button"
                onClick={() => updateDifficulty("HARD")}
                className={tabGroupButtonClass(isHard, "hard")}
              >
                Hard Draft
              </button>
            </div>
            {isHard && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-red-400`}>
                Ratings and values hidden until season review.
              </p>
            )}
          </div>

          <Link
            href={draftHref}
            onClick={() => playUiClick()}
            className={`mt-5 w-full ${BTN.base} ${isHard ? BTN.primaryHard : BTN.primary}`}
          >
            {isHard ? "Start Hard Draft" : "Start Draft"} →
          </Link>
        </ModePanel>

        <Link
          href={buildPlayHref("cup")}
          onClick={() => playModeChallengeCupStart()}
          className={`${CARD.glass} ${CARD.panel} group block w-full ${SPACING.cardPaddingLg} transition hover:border-accent-gold/30`}
        >
          <h2 className={`${TYPO.cardTitle} group-hover:text-accent-gold`}>
            Challenge Cup
          </h2>
          <p className={`mt-3 ${TYPO.body}`}>
            Draft your squad and battle through a knockout tournament. Win four
            matches to lift the cup.
          </p>
          <span className={`mt-5 ${BTN.base} ${BTN.goldOutline}`}>
            Start Challenge Cup →
          </span>
        </Link>
      </div>
    </div>
  );
}

function ModePanel({
  title,
  hardActive,
  children,
}: {
  title: string;
  hardActive: boolean;
  children: ReactNode;
}) {
  const cardAccent = hardActive
    ? `${HARD.modeCard} ${HARD.modeCardHover}`
    : `${CARD.featured} ${NORMAL.modeCardHover}`;

  return (
    <div
      className={`${CARD.glass} ${CARD.panel} group w-full ${SPACING.cardPaddingLg} transition ${cardAccent}`}
    >
      <h2
        className={`${TYPO.cardTitle} ${
          hardActive ? "text-red-300" : "text-white"
        }`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
