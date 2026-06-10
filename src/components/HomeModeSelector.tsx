"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameDifficulty } from "@/lib/types";
import {
  getDifficulty,
  getRecruitmentStyle,
  setDifficulty,
  setRecruitmentStyle,
  type RecruitmentStyle,
} from "@/lib/storage/preferences";
import { GuestNotice } from "./GuestNotice";
import { TYPO } from "@/lib/ui/typography";

function buildPlayQuery(
  difficulty: GameDifficulty,
  options?: { cup?: boolean; draft?: boolean }
): string {
  const params = new URLSearchParams();
  if (options?.cup) params.set("cup", "1");
  if (difficulty === "HARD") params.set("difficulty", "hard");
  if (options?.draft) params.set("draft", "1");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function HomeModeSelector() {
  const [difficulty, setDifficultyState] = useState<GameDifficulty>("NORMAL");
  const [recruitmentStyle, setRecruitmentStyleState] =
    useState<RecruitmentStyle>("manual");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDifficultyState(getDifficulty());
    setRecruitmentStyleState(getRecruitmentStyle());
    setMounted(true);
  }, []);

  const selectDifficulty = (d: GameDifficulty) => {
    setDifficulty(d);
    setDifficultyState(d);
  };

  const selectRecruitmentStyle = (style: RecruitmentStyle) => {
    setRecruitmentStyle(style);
    setRecruitmentStyleState(style);
  };

  const seasonHref = mounted
    ? `/play${buildPlayQuery(difficulty, {
        draft: recruitmentStyle === "draft",
      })}`
    : "/play";
  const cupHref = mounted
    ? `/play${buildPlayQuery(difficulty, { cup: true })}`
    : "/play?cup=1";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className="mb-8 mt-4 flex flex-col items-center">
        <p className={`mb-3 ${TYPO.sectionLabel}`}>Select Difficulty</p>
        <div className="inline-flex rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1">
          <button
            type="button"
            onClick={() => selectDifficulty("NORMAL")}
            className={`rounded-lg px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition ${
              difficulty === "NORMAL"
                ? "bg-accent-green text-pitch-950 shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Normal Mode
          </button>
          <button
            type="button"
            onClick={() => selectDifficulty("HARD")}
            className={`rounded-lg px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition ${
              difficulty === "HARD"
                ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Hard Mode
          </button>
        </div>
        {difficulty === "HARD" && (
          <p className="mt-3 max-w-md text-center text-xs text-red-400/80">
            Ratings and values hidden — judge players by Rugby League knowledge
            alone.
          </p>
        )}
      </div>

      <div className="mx-auto mb-6 flex max-w-2xl flex-col items-center">
          <p className={`mb-3 ${TYPO.sectionLabel}`}>Recruitment Style</p>
          <div className="inline-flex rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1">
            <button
              type="button"
              onClick={() => selectRecruitmentStyle("manual")}
              className={`rounded-lg px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:px-6 sm:text-sm ${
                recruitmentStyle === "manual"
                  ? "bg-accent-green text-pitch-950 shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Manual Position
            </button>
            <button
              type="button"
              onClick={() => selectRecruitmentStyle("draft")}
              className={`rounded-lg px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:px-6 sm:text-sm ${
                recruitmentStyle === "draft"
                  ? "bg-accent-green text-pitch-950 shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Draft Mode
            </button>
          </div>
          <p className="mt-2 max-w-md text-center text-xs text-gray-500">
            {recruitmentStyle === "manual"
              ? "Choose which position to fill on the team sheet."
              : "Pick players, then place them in any empty slot. Out-of-position placements cost 5 OVR."}
          </p>
        </div>

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href={seasonHref}
          className="card-glass matchday-panel group block p-6 transition hover:border-accent-green/30"
        >
          <h2 className="font-display text-xl font-bold group-hover:text-accent-green">
            Normal Mode
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Draft your XIII and simulate a full Super League campaign. Can you
            go 27-0?
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-accent-green">
            Start Season →
          </span>
        </Link>

        <Link
          href={cupHref}
          className="card-glass matchday-panel group block p-6 transition hover:border-accent-gold/30"
        >
          <h2 className="font-display text-xl font-bold group-hover:text-accent-gold">
            Challenge Cup
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Draft your squad and battle through a knockout tournament. Win four
            matches to lift the cup.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-accent-gold">
            Start Cup Run →
          </span>
        </Link>
      </div>
    </div>
  );
}
