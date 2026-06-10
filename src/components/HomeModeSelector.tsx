"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { GameDifficulty } from "@/lib/types";
import { GuestNotice } from "./GuestNotice";
import { TYPO } from "@/lib/ui/typography";

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

      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <ModePanel title="Normal Mode" accent="green">
          <p className="text-sm leading-relaxed text-gray-400">
            Draft your XIII position by position and simulate a full Super League
            campaign. Can you go 27-0?
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Difficulty</p>
            <div className="inline-flex w-full rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setClassicDifficulty("NORMAL")}
                className={`flex-1 rounded-lg px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:flex-none sm:px-5 sm:text-sm ${
                  classicDifficulty === "NORMAL"
                    ? "bg-accent-green text-pitch-950 shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setClassicDifficulty("HARD")}
                className={`flex-1 rounded-lg px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:flex-none sm:px-5 sm:text-sm ${
                  classicDifficulty === "HARD"
                    ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Hard
              </button>
            </div>
            {classicDifficulty === "HARD" && (
              <p className="mt-2 text-xs text-red-400/80">
                Ratings and values hidden until season review. No rerolls.
              </p>
            )}
          </div>

          <Link
            href={classicHref}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-accent-green/40 bg-accent-green/10 px-4 py-3 text-sm font-semibold text-accent-green transition hover:bg-accent-green/20 sm:w-auto"
          >
            {classicAction} →
          </Link>
        </ModePanel>

        <ModePanel title="Draft Mode" accent="green">
          <p className="text-sm leading-relaxed text-gray-400">
            Pick players from pairs, then place them in any empty slot. Natural
            positions carry no penalty; out-of-position placements cost 5 OVR.
          </p>

          <div className="mt-5">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Draft Type</p>
            <div className="inline-flex w-full rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setDraftDifficulty("NORMAL")}
                className={`flex-1 rounded-lg px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:flex-none sm:px-5 sm:text-sm ${
                  draftDifficulty === "NORMAL"
                    ? "bg-accent-green text-pitch-950 shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Standard Draft
              </button>
              <button
                type="button"
                onClick={() => setDraftDifficulty("HARD")}
                className={`flex-1 rounded-lg px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition sm:flex-none sm:px-5 sm:text-sm ${
                  draftDifficulty === "HARD"
                    ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Hard Draft
              </button>
            </div>
            {draftDifficulty === "HARD" && (
              <p className="mt-2 text-xs text-red-400/80">
                Ratings and values hidden until season review.
              </p>
            )}
          </div>

          <Link
            href={draftHref}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-accent-green/40 bg-accent-green/10 px-4 py-3 text-sm font-semibold text-accent-green transition hover:bg-accent-green/20 sm:w-auto"
          >
            Start Draft →
          </Link>
        </ModePanel>

        <Link
          href="/play?cup=1"
          className="card-glass matchday-panel group block w-full p-6 transition hover:border-accent-gold/30 sm:p-7"
        >
          <h2 className="font-display text-xl font-bold group-hover:text-accent-gold sm:text-2xl">
            Challenge Cup
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Draft your squad and battle through a knockout tournament. Win four
            matches to lift the cup.
          </p>
          <span className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-accent-gold/35 bg-accent-gold/10 px-4 py-3 text-sm font-semibold text-accent-gold transition group-hover:bg-accent-gold/15 sm:w-auto">
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
      className={`card-glass matchday-panel group w-full p-6 transition sm:p-7 ${hoverBorder}`}
    >
      <h2
        className={`font-display text-xl font-bold sm:text-2xl ${hoverTitle}`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
