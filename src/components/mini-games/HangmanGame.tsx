"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { playUiClick } from "@/lib/sound";
import { getLocalDateKey } from "@/lib/mini-games/date";
import { HANGMAN_CATEGORY_LABEL } from "@/lib/mini-games/hangman/answers";
import {
  createHangmanRun,
  guessHangmanLetter,
  isHangmanPunctuation,
  recordHangmanResult,
  remainingHangmanLives,
} from "@/lib/mini-games/hangman/engine";
import {
  loadHangmanRun,
  loadHangmanStats,
  saveHangmanRun,
  saveHangmanStats,
} from "@/lib/mini-games/hangman/storage";
import type { HangmanRun } from "@/lib/mini-games/hangman/types";
import {
  claimMiniGameReward,
  HANGMAN_WIN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

type HangmanView = HangmanRun & { payoutAwarded?: boolean };

function displayAnswer(run: HangmanRun): string[] {
  const guessed = new Set(run.guessed);
  return [...run.answer].map((char) => {
    if (isHangmanPunctuation(char)) return char;
    const letter = char
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (run.status !== "playing") return char;
    return guessed.has(letter) ? char : "_";
  });
}

function settleHangman(run: HangmanRun): HangmanView {
  if (run.status === "playing" || run.rewardClaimed) return run;
  saveHangmanStats(recordHangmanResult(loadHangmanStats(), run));
  triggerMiniGameAchievements({
    played: true,
    hangmanWon: run.status === "won",
  });
  if (run.status !== "won" || !run.daily) {
    return { ...run, rewardClaimed: true };
  }
  const payout = claimMiniGameReward(
    `hangman_win:${run.date}`,
    "Rugby League Hangman",
    HANGMAN_WIN_REWARD
  );
  return { ...run, rewardClaimed: true, payoutAwarded: payout.awarded };
}

export function HangmanGame() {
  const [run, setRun] = useState<HangmanView | null>(null);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState(() => ({
    currentStreak: 0,
    bestStreak: 0,
    wins: 0,
  }));

  useEffect(() => {
    const today = getLocalDateKey();
    const stored = loadHangmanRun();
    const next =
      stored && stored.date === today
        ? stored
        : createHangmanRun({ date: today, daily: true });
    const settled =
      next.status !== "playing" && !next.rewardClaimed
        ? settleHangman(next)
        : next;
    saveHangmanRun(settled);
    setRun(settled);
    setStats(loadHangmanStats());
    triggerMiniGameAchievements({ played: true });
    setReady(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!run || run.status !== "playing") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const letter = event.key;
      if (!/^[a-zA-Z]$/.test(letter)) return;
      event.preventDefault();
      playLetter(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const letters = useMemo(() => (run ? displayAnswer(run) : []), [run]);

  const persist = (next: HangmanView) => {
    saveHangmanRun(next);
    setRun(next);
    setStats(loadHangmanStats());
  };

  const playLetter = (raw: string) => {
    if (!run) return;
    playUiClick();
    const result = guessHangmanLetter(run, raw);
    if (!result.accepted) return;
    persist(
      result.run.status === "playing" ? result.run : settleHangman(result.run)
    );
  };

  const startPractice = () => {
    playUiClick();
    const today = getLocalDateKey();
    const next = createHangmanRun({
      date: today,
      daily: false,
      excludePuzzleId: run?.puzzleId,
    });
    persist(next);
  };

  return (
    <MiniGameShell title="Rugby League Hangman">
      <p className={`mt-2 ${TYPO.pageSubtitle}`}>
        Guess the player, club or rugby league term. Eight wrong letters and
        you&apos;re done.
      </p>
      <MiniGameStatLine
        items={[
          { label: "Lives", value: run ? remainingHangmanLives(run) : 8 },
          { label: "Streak", value: stats.currentStreak },
          { label: "Best", value: stats.bestStreak },
        ]}
      />

      {!ready || !run ? (
        <p className={`mt-6 ${TYPO.meta}`}>Loading puzzle…</p>
      ) : (
        <>
          <p className={`mt-6 ${TYPO.keyLabel}`}>
            {HANGMAN_CATEGORY_LABEL[run.category]}
            {run.daily ? " · Daily" : " · Practice"}
          </p>
          <p className={`mt-1 ${TYPO.bodySm}`}>{run.hint}</p>

          <p
            className="mt-6 flex flex-wrap justify-center gap-1 font-display text-2xl tracking-[0.2em] text-white"
            aria-label={letters.join("")}
          >
            {letters.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="inline-flex min-w-[1.1rem] justify-center"
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </p>

          <div className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-1.5">
            {ROWS.map((row) => (
              <div key={row} className="flex justify-center gap-1">
                {[...row].map((letter) => {
                  const used = run.guessed.includes(letter);
                  const inAnswer = run.answer
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .includes(letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={run.status !== "playing" || used}
                      onClick={() => playLetter(letter)}
                      className={`hangman-key flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-md border text-sm font-semibold ${
                        used
                          ? inAnswer
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-white/5 bg-white/5 text-gray-500"
                          : "border-white/15 bg-[#0c1210] text-white"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {run.status !== "playing" && (
            <div className="mt-6 border border-white/10 bg-[#0c1210] px-4 py-4 text-center">
              <p className={TYPO.cardTitle}>
                {run.status === "won" ? "Solved" : "Out of lives"}
              </p>
              <p className={`mt-2 ${TYPO.body}`}>{run.answer}</p>
              {run.status === "won" && run.payoutAwarded && (
                <p className={`mt-2 ${TYPO.bodySm}`}>
                  +{formatClubFundsExact(HANGMAN_WIN_REWARD)} Club Funds
                </p>
              )}
              <div className="mx-auto mt-4 max-w-xs">
                <GameButton variant="theme" onClick={startPractice}>
                  Play another
                </GameButton>
              </div>
            </div>
          )}
        </>
      )}
    </MiniGameShell>
  );
}
