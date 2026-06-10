"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [draftDifficulty, setDraftDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const draftHref = mounted
    ? buildPlayHref("draft", draftDifficulty)
    : "/play?draft=1";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <ModeCard
          href="/play"
          title="Normal Mode"
          description="Draft your XIII position by position and simulate a full Super League campaign. Can you go 27-0?"
          action="Start Season"
          accent="green"
        />

        <ModeCard
          href="/play?difficulty=hard"
          title="Hard Mode"
          description="Ratings and values hidden during recruitment — judge players by Rugby League knowledge alone."
          action="Start Hard Season"
          accent="red"
        />

        <div className="card-glass matchday-panel group flex flex-col p-6 transition hover:border-accent-green/30">
          <h2 className="font-display text-xl font-bold group-hover:text-accent-green">
            Draft Mode
          </h2>
          <p className="mt-2 flex-1 text-sm text-gray-400">
            Pick players from pairs, then place them in any empty slot. Natural
            positions carry no penalty; out-of-position placements cost 5 OVR.
          </p>

          <div className="mt-4">
            <p className={`mb-2 ${TYPO.sectionLabel}`}>Draft Type</p>
            <div className="inline-flex rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1">
              <button
                type="button"
                onClick={() => setDraftDifficulty("NORMAL")}
                className={`rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider transition sm:px-5 sm:text-sm ${
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
                className={`rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider transition sm:px-5 sm:text-sm ${
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
            className="mt-4 inline-block text-sm font-semibold text-accent-green"
          >
            Start Draft →
          </Link>
        </div>

        <ModeCard
          href="/play?cup=1"
          title="Challenge Cup"
          description="Draft your squad and battle through a knockout tournament. Win four matches to lift the cup."
          action="Start Challenge Cup"
          accent="gold"
        />
      </div>
    </div>
  );
}

function ModeCard({
  href,
  title,
  description,
  action,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  action: string;
  accent: "green" | "red" | "gold";
}) {
  const hoverBorder =
    accent === "gold"
      ? "hover:border-accent-gold/30"
      : accent === "red"
        ? "hover:border-red-500/30"
        : "hover:border-accent-green/30";
  const hoverTitle =
    accent === "gold"
      ? "group-hover:text-accent-gold"
      : accent === "red"
        ? "group-hover:text-red-400"
        : "group-hover:text-accent-green";
  const actionColor =
    accent === "gold"
      ? "text-accent-gold"
      : accent === "red"
        ? "text-red-400"
        : "text-accent-green";

  return (
    <Link
      href={href}
      className={`card-glass matchday-panel group block p-6 transition ${hoverBorder}`}
    >
      <h2 className={`font-display text-xl font-bold ${hoverTitle}`}>{title}</h2>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
      <span className={`mt-4 inline-block text-sm font-semibold ${actionColor}`}>
        {action} →
      </span>
    </Link>
  );
}
