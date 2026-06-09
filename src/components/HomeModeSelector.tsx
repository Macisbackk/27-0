"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameDifficulty } from "@/lib/types";
import { getDifficulty, setDifficulty } from "@/lib/storage/preferences";
import { hasUsername } from "@/lib/storage/user";
import { TYPO } from "@/lib/ui/typography";

export function HomeModeSelector() {
  const [difficulty, setDifficultyState] = useState<GameDifficulty>("NORMAL");
  const [mounted, setMounted] = useState(false);
  const [usernameReady, setUsernameReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDifficultyState(getDifficulty());
      setUsernameReady(hasUsername());
      setMounted(true);
    };
    sync();
    window.addEventListener("coach-username-changed", sync);
    return () => window.removeEventListener("coach-username-changed", sync);
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

  const blockedMessage = !usernameReady
    ? "Choose your coach name above before starting a run."
    : null;

  return (
    <div>
      <div className="mb-8 flex flex-col items-center">
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

      {blockedMessage && (
        <p className="mb-4 text-center text-sm font-medium text-amber-400/90">
          {blockedMessage}
        </p>
      )}

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        {usernameReady ? (
          <>
            <Link
              href={seasonHref}
              className="card-glass matchday-panel group block p-6 transition hover:border-accent-green/30"
            >
              <h2 className="font-display text-xl font-bold group-hover:text-accent-green">
                Super League Season
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Draft your XIII and simulate a full Super League campaign. Can
                you go 27-0?
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
                Draft your squad and battle through a knockout tournament. Win
                four matches to lift the cup.
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-accent-gold">
                Start Cup Run →
              </span>
            </Link>
          </>
        ) : (
          <>
            <ModeCardDisabled
              title="Super League Season"
              description="Draft your XIII and simulate a full Super League campaign."
              accent="green"
            />
            <ModeCardDisabled
              title="Challenge Cup"
              description="Draft your squad and battle through a knockout tournament."
              accent="gold"
            />
          </>
        )}
      </div>
    </div>
  );
}

function ModeCardDisabled({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: "green" | "gold";
}) {
  return (
    <div
      className={`card-glass matchday-panel block cursor-not-allowed p-6 opacity-50 ${
        accent === "green" ? "" : ""
      }`}
      aria-disabled
    >
      <h2 className="font-display text-xl font-bold text-gray-500">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <span className="mt-4 inline-block text-sm font-semibold text-gray-600">
        Coach name required
      </span>
    </div>
  );
}
