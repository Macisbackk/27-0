"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameDifficulty } from "@/lib/types";
import { getDifficulty, setDifficulty } from "@/lib/storage/preferences";
import { GuestNotice } from "./GuestNotice";
import { TYPO } from "@/lib/ui/typography";

export function HomeModeSelector() {
  const [difficulty, setDifficultyState] = useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDifficultyState(getDifficulty());
    setMounted(true);
  }, []);

  const select = (d: GameDifficulty) => {
    setDifficulty(d);
    setDifficultyState(d);
  };

  const query = difficulty === "HARD" ? "?difficulty=hard" : "";
  const seasonHref = mounted ? `/play${query}` : "/play";
  const cupHref = mounted
    ? `/play?cup=1${query ? query.replace("?", "&") : ""}`
    : "/play?cup=1";

  return (
    <div>
      <GuestNotice variant="home" />

      <div className="mb-8 mt-4 flex flex-col items-center">
        <p className={`mb-3 ${TYPO.sectionLabel}`}>Select Difficulty</p>
        <div className="inline-flex rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1">
          <button
            type="button"
            onClick={() => select("NORMAL")}
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
            onClick={() => select("HARD")}
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

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href={seasonHref}
          className="card-glass matchday-panel group block p-6 transition hover:border-accent-green/30"
        >
          <h2 className="font-display text-xl font-bold group-hover:text-accent-green">
            Super League Season
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
