"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { GameDifficulty } from "@/lib/types";
import { buildPlayHref } from "@/lib/play-links";
import {
  getModeDifficulty,
  MODE_DIFFICULTY_CHANGED_EVENT,
  setModeDifficulty,
  type PlayModeKey,
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
  const [classicDifficulty, setClassicDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [draftDifficulty, setDraftDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setClassicDifficulty(getModeDifficulty("normal"));
    setDraftDifficulty(getModeDifficulty("draft"));
    setMounted(true);

    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ mode: PlayModeKey; difficulty: GameDifficulty }>)
        .detail;
      if (!detail) return;
      if (detail.mode === "normal") setClassicDifficulty(detail.difficulty);
      if (detail.mode === "draft") setDraftDifficulty(detail.difficulty);
    };

    window.addEventListener(MODE_DIFFICULTY_CHANGED_EVENT, sync);
    return () =>
      window.removeEventListener(MODE_DIFFICULTY_CHANGED_EVENT, sync);
  }, []);

  const updateModeDifficulty = (mode: PlayModeKey, next: GameDifficulty) => {
    const current =
      mode === "normal" ? classicDifficulty : draftDifficulty;
    if (next === "HARD" && current !== "HARD") playHardModeOn();
    if (next === "NORMAL" && current === "HARD") playHardModeOff();
    if (mode === "normal") setClassicDifficulty(next);
    else setDraftDifficulty(next);
    setModeDifficulty(mode, next);
  };

  const classicHref = mounted
    ? buildPlayHref("classic", classicDifficulty)
    : "/play";
  const draftHref = mounted
    ? buildPlayHref("draft", draftDifficulty)
    : "/play?draft=1";
  const classicHard = classicDifficulty === "HARD";
  const draftHard = draftDifficulty === "HARD";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className={`mx-auto flex max-w-xl flex-col gap-5`}>
        <ModePanel title="Normal Mode" hardActive={classicHard}>
          <p className={TYPO.body}>
            Draft your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Difficulty</p>
            <div className={tabGroupClass(classicHard, !classicHard)}>
              <button
                type="button"
                onClick={() => updateModeDifficulty("normal", "NORMAL")}
                className={tabGroupButtonClass(!classicHard, "normal")}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => updateModeDifficulty("normal", "HARD")}
                className={tabGroupButtonClass(classicHard, "hard")}
              >
                Hard
              </button>
            </div>
            {classicHard && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-accent-red`}>
                Ratings and values hidden until season review. No rerolls.
              </p>
            )}
          </div>

          <Link
            href={classicHref}
            onClick={() => playUiClick()}
            className={`mt-5 w-full ${BTN.base} ${classicHard ? BTN.primaryHard : BTN.primary}`}
          >
            {classicHard ? "Start Hard Season" : "Start Season"} →
          </Link>
        </ModePanel>

        <ModePanel title="Draft Mode" hardActive={draftHard}>
          <p className={TYPO.body}>
            Pick players from pairs, then place them in any empty slot. Natural
            positions carry no penalty; out-of-position placements cost 5 OVR.
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Draft Type</p>
            <div className={tabGroupClass(draftHard, !draftHard)}>
              <button
                type="button"
                onClick={() => updateModeDifficulty("draft", "NORMAL")}
                className={tabGroupButtonClass(!draftHard, "normal")}
              >
                Standard Draft
              </button>
              <button
                type="button"
                onClick={() => updateModeDifficulty("draft", "HARD")}
                className={tabGroupButtonClass(draftHard, "hard")}
              >
                Hard Draft
              </button>
            </div>
            {draftHard && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-accent-red`}>
                Ratings and values hidden until season review.
              </p>
            )}
          </div>

          <Link
            href={draftHref}
            onClick={() => playUiClick()}
            className={`mt-5 w-full ${BTN.base} ${draftHard ? BTN.primaryHard : BTN.primary}`}
          >
            {draftHard ? "Start Hard Draft" : "Start Draft"} →
          </Link>
        </ModePanel>

        <Link
          href={buildPlayHref("fantasy")}
          onClick={() => playUiClick()}
          className={`${CARD.glass} ${CARD.panel} group block w-full ${SPACING.cardPaddingLg} transition hover:border-accent-green/30`}
        >
          <h2 className={`${TYPO.cardTitle} group-hover:text-accent-green`}>
            Fantasy Mode
          </h2>
          <p className={`mt-3 ${TYPO.body}`}>
            Build your dream squad under a budget, then take on randomised Super
            League teams across 27 rounds.
          </p>
          <ul className={`mt-3 space-y-1 ${TYPO.bodySm} text-gray-500`}>
            <li>Budget £3M · Squad 13 · 27 rounds</li>
          </ul>
          <span className={`mt-5 ${BTN.base} ${BTN.primary}`}>
            Start Fantasy Mode →
          </span>
        </Link>

        <Link
          href={buildPlayHref("cup")}
          onClick={() => playModeChallengeCupStart()}
          className={`${CARD.glass} ${CARD.panel} group block w-full ${SPACING.cardPaddingLg} transition hover:border-accent-gold/30`}
        >
          <h2 className={`${TYPO.cardTitle} group-hover:text-accent-gold`}>
            Challenge Cup
          </h2>
          <p className={`mt-3 ${TYPO.body}`}>
            Draft your squad and battle through a knockout tournament — or switch
            to Era Mode and lead a historic season squad through the draw.
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
          hardActive ? "text-accent-red" : "text-white"
        }`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
