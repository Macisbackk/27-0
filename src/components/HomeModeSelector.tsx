"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { GameDifficulty } from "@/lib/types";
import {
  playHardModeOff,
  playHardModeOn,
  playModeChallengeCupStart,
  playUiClick,
} from "@/lib/sound";
import {
  BTN,
  CARD,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GuestNotice } from "./GuestNotice";

function buildPlayHref(
  mode: "classic" | "draft" | "cup",
  difficulty: GameDifficulty = "NORMAL"
): string {
  const params = new URLSearchParams();
  if (mode === "cup") params.set("cup", "1");
  if (mode === "draft") params.set("draft", "1");
  if (difficulty === "HARD") params.set("difficulty", "hard");
  const qs = params.toString();
  return qs ? `/play?${qs}` : "/play";
}

export function HomeModeSelector() {
  const [classicDifficulty, setClassicDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [draftDifficulty, setDraftDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const classicHref = mounted
    ? buildPlayHref("classic", classicDifficulty)
    : "/play";
  const draftHref = mounted
    ? buildPlayHref("draft", draftDifficulty)
    : "/play?draft=1";

  const classicAction =
    classicDifficulty === "HARD" ? "Start Hard Season" : "Start Season";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className={`mx-auto flex max-w-xl flex-col gap-5`}>
        <ModePanel title="Normal Mode" accent="green">
          <p className={TYPO.body}>
            Draft your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Difficulty</p>
            <div className={tabGroupClass(classicDifficulty === "HARD")}>
              <button
                type="button"
                onClick={() => {
                  if (classicDifficulty === "HARD") playHardModeOff();
                  setClassicDifficulty("NORMAL");
                }}
                className={tabGroupButtonClass(
                  classicDifficulty === "NORMAL",
                  "normal"
                )}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (classicDifficulty !== "HARD") playHardModeOn();
                  setClassicDifficulty("HARD");
                }}
                className={tabGroupButtonClass(
                  classicDifficulty === "HARD",
                  "hard"
                )}
              >
                Hard
              </button>
            </div>
            {classicDifficulty === "HARD" && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-red-400`}>
                Ratings and values hidden until season review. No rerolls.
              </p>
            )}
          </div>

          <Link
            href={classicHref}
            onClick={() => playUiClick()}
            className={`mt-5 ${BTN.base} ${BTN.accentOutline}`}
          >
            {classicAction} →
          </Link>
        </ModePanel>

        <ModePanel title="Draft Mode" accent="green">
          <p className={TYPO.body}>
            Pick players from pairs, then place them in any empty slot. Natural
            positions carry no penalty; out-of-position placements cost 5 OVR.
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Draft Type</p>
            <div className={tabGroupClass(draftDifficulty === "HARD")}>
              <button
                type="button"
                onClick={() => {
                  if (draftDifficulty === "HARD") playHardModeOff();
                  setDraftDifficulty("NORMAL");
                }}
                className={tabGroupButtonClass(
                  draftDifficulty === "NORMAL",
                  "normal"
                )}
              >
                Standard Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  if (draftDifficulty !== "HARD") playHardModeOn();
                  setDraftDifficulty("HARD");
                }}
                className={tabGroupButtonClass(
                  draftDifficulty === "HARD",
                  "hard"
                )}
              >
                Hard Draft
              </button>
            </div>
            {draftDifficulty === "HARD" && (
              <p className={`mt-2 ${TYPO.bodySm} font-medium text-red-400`}>
                Ratings and values hidden until season review.
              </p>
            )}
          </div>

          <Link
            href={draftHref}
            onClick={() => playUiClick()}
            className={`mt-5 ${BTN.base} ${BTN.accentOutline}`}
          >
            Start Draft →
          </Link>
        </ModePanel>

        <Link
          href="/play?cup=1"
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
  accent,
  children,
}: {
  title: string;
  accent: "green" | "gold";
  children: ReactNode;
}) {
  const hoverBorder =
    accent === "gold"
      ? "hover:border-accent-gold/30"
      : "hover:border-accent-green/30";
  const hoverTitle =
    accent === "gold"
      ? "group-hover:text-accent-gold"
      : "group-hover:text-accent-green";

  return (
    <div
      className={`${CARD.glass} ${CARD.panel} group w-full ${SPACING.cardPaddingLg} transition ${hoverBorder}`}
    >
      <h2 className={`${TYPO.cardTitle} ${hoverTitle}`}>{title}</h2>
      {children}
    </div>
  );
}
