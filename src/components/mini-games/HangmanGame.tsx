"use client";

import { useEffect, useMemo, useState } from "react";
import { MiniGameShell, MiniGameStatLine, MiniGameEndActions } from "./MiniGameShell";
import { MiniGamePoolSelect } from "./MiniGamePoolSelect";
import { MiniGameRewardPopup } from "./MiniGameRewardPopup";
import { TYPO } from "@/lib/ui/typography";
import { getLocalDateKey } from "@/lib/mini-games/date";
import { getHangmanBank } from "@/lib/mini-games/hangman/answers";
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
  isMiniGamePoolMode,
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";
import {
  claimMiniGameReward,
  HANGMAN_WIN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { Confetti } from "@/components/Confetti";
import {
  playMiniCorrect,
  playMiniIncorrect,
  playMiniSelect,
  playMiniWin,
  playMiniLose,
} from "@/lib/mini-games/sound";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

type HangmanView = HangmanRun & { payoutAwarded?: boolean };
type View = "select" | "play";

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

/** Split letters into words so multi-word names stay coherent on mobile. */
function answerWords(letters: string[]): string[][] {
  const words: string[][] = [[]];
  for (const char of letters) {
    if (char === " ") {
      words.push([]);
      continue;
    }
    words[words.length - 1]!.push(char);
  }
  return words.filter((word) => word.length > 0);
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
  const modeKey = run.poolMode ? `:${run.poolMode}` : "";
  const payout = claimMiniGameReward(
    `hangman_win:${run.date}${modeKey}`,
    "Rugby League Hangman",
    HANGMAN_WIN_REWARD
  );
  return { ...run, rewardClaimed: true, payoutAwarded: payout.awarded };
}

export function HangmanGame() {
  const [view, setView] = useState<View>("select");
  const [poolMode, setPoolMode] = useState<MiniGamePoolMode | null>(null);
  const [run, setRun] = useState<HangmanView | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [stats, setStats] = useState(() => ({
    currentStreak: 0,
    bestStreak: 0,
    wins: 0,
  }));

  useEffect(() => {
    const today = getLocalDateKey();
    const stored = loadHangmanRun();
    setStats(loadHangmanStats());
    if (
      stored &&
      stored.date === today &&
      stored.status === "playing" &&
      isMiniGamePoolMode(stored.poolMode)
    ) {
      setPoolMode(stored.poolMode);
      setRun(stored);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== "play" || !run || run.status !== "playing") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const letter = event.key;
      if (!/^[a-zA-Z]$/.test(letter)) return;
      event.preventDefault();
      playLetter(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // playLetter closes over latest run; rebind when the active puzzle changes.
  }, [view, run]);

  const letters = useMemo(() => (run ? displayAnswer(run) : []), [run]);
  const words = useMemo(() => answerWords(letters), [letters]);
  const eraMeta = useMemo(() => {
    if (!run || run.category !== "player") return null;
    if (typeof run.year === "number" && run.isHistoric !== undefined) {
      return { isHistoric: run.isHistoric, year: run.year };
    }
    const bank = getHangmanBank(run.poolMode);
    const puzzle = bank.find((item) => item.id === run.puzzleId);
    if (
      puzzle &&
      typeof puzzle.year === "number" &&
      puzzle.isHistoric !== undefined
    ) {
      return { isHistoric: puzzle.isHistoric, year: puzzle.year };
    }
    return null;
  }, [run]);
  const letterCount = letters.filter((char) => char !== " ").length;
  const answerFontClass =
    letterCount > 16
      ? "text-lg tracking-[0.12em] sm:text-xl"
      : letterCount > 12
        ? "text-xl tracking-[0.14em] sm:text-2xl"
        : "text-2xl tracking-[0.18em] sm:text-3xl";

  const hasResume =
    Boolean(run) &&
    run?.status === "playing" &&
    isMiniGamePoolMode(run.poolMode);

  const persist = (next: HangmanView) => {
    saveHangmanRun(next);
    setRun(next);
    setStats(loadHangmanStats());
  };

  const startMode = (mode: MiniGamePoolMode) => {
    const today = getLocalDateKey();
    const stored = loadHangmanRun();
    if (
      stored &&
      stored.date === today &&
      stored.poolMode === mode &&
      (stored.status === "playing" ||
        stored.status === "won" ||
        stored.status === "lost")
    ) {
      const settled =
        stored.status !== "playing" && !stored.rewardClaimed
          ? settleHangman(stored)
          : stored;
      if (settled !== stored) saveHangmanRun(settled);
      setPoolMode(mode);
      setRun(settled);
      setView("play");
      setFlash(null);
      setCelebrate(settled.status === "won");
      setRewardOpen(Boolean(settled.payoutAwarded && settled.status === "won"));
      triggerMiniGameAchievements({ played: true });
      return;
    }
    const next = createHangmanRun({ date: today, daily: true, poolMode: mode });
    setPoolMode(mode);
    setFlash(null);
    setCelebrate(false);
    setRewardOpen(false);
    persist(next);
    setView("play");
    triggerMiniGameAchievements({ played: true });
  };

  const resume = () => {
    if (!run || !isMiniGamePoolMode(run.poolMode)) return;
    setPoolMode(run.poolMode);
    setView("play");
  };

  const playLetter = (raw: string) => {
    if (!run) return;
    playMiniSelect();
    const result = guessHangmanLetter(run, raw);
    if (!result.accepted) return;
    const letter = raw.toUpperCase();
    const hit = run.answer
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(letter);
    if (hit) {
      playMiniCorrect();
      setFlash("good");
    } else {
      playMiniIncorrect();
      setFlash("bad");
    }
    window.setTimeout(() => setFlash(null), 280);
    const next: HangmanView =
      result.run.status === "playing"
        ? result.run
        : settleHangman(result.run);
    if (next.status === "won") {
      playMiniWin();
      setCelebrate(true);
      if (next.payoutAwarded) setRewardOpen(true);
    }
    if (next.status === "lost") playMiniLose();
    persist(next);
  };

  const startPractice = () => {
    if (!poolMode) {
      setView("select");
      return;
    }
    playMiniSelect();
    const today = getLocalDateKey();
    const next = createHangmanRun({
      date: today,
      daily: false,
      poolMode,
      excludePuzzleId: run?.puzzleId,
    });
    setFlash(null);
    setCelebrate(false);
    setRewardOpen(false);
    persist(next);
  };

  if (!ready) {
    return (
      <MiniGameShell title="Rugby League Hangman">
        <p className={`mt-6 text-center ${TYPO.meta}`}>Loading…</p>
      </MiniGameShell>
    );
  }

  if (view === "select") {
    return (
      <MiniGameShell
        eyebrow="Rugby League Hangman"
        title="Choose Current or Era"
      >
        <MiniGamePoolSelect
          subtitle="Guess players, clubs and rugby league terms from today’s game or the eras."
          onSelect={startMode}
          resumeLabel={hasResume ? "Resume Hangman" : undefined}
          onResume={hasResume ? resume : undefined}
        />
      </MiniGameShell>
    );
  }

  return (
    <MiniGameShell title="Rugby League Hangman">
      {celebrate && <Confetti />}
      <MiniGameRewardPopup
        open={rewardOpen}
        amount={HANGMAN_WIN_REWARD}
        detail="Reward for solving today's Hangman."
        onClose={() => setRewardOpen(false)}
      />
      <div className="mini-game-play mx-auto flex w-full max-w-lg flex-col items-center">
        <p className={`mt-2 text-center ${TYPO.pageSubtitle}`}>
          {poolMode
            ? `${MINI_GAME_POOL_MODE_LABEL[poolMode]} — eight wrong letters and you\u2019re done.`
            : "Guess the player, club or rugby league term. Eight wrong letters and you\u2019re done."}
        </p>
        <div className="text-center">
          <MiniGameStatLine
            items={[
              { label: "Lives", value: run ? remainingHangmanLives(run) : 8 },
              { label: "Streak", value: stats.currentStreak },
              { label: "Best", value: stats.bestStreak },
            ]}
          />
        </div>

        {!run ? (
          <p className={`mt-6 text-center ${TYPO.meta}`}>Loading puzzle…</p>
        ) : (
          <>
            <p className={`mt-6 text-center ${TYPO.bodySm}`}>{run.hint}</p>
            {eraMeta &&
              (eraMeta.isHistoric ? (
                <p
                  className="mt-1.5 text-center font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-gold"
                  aria-label={`Era player from ${eraMeta.year}`}
                >
                  Era · {eraMeta.year}
                </p>
              ) : (
                <p className={`mt-1.5 text-center ${TYPO.meta}`}>Current</p>
              ))}

            <div
              className="mini-game-lives"
              aria-label={`${remainingHangmanLives(run)} lives remaining`}
            >
              {Array.from({ length: 8 }, (_, index) => {
                const lost = index >= remainingHangmanLives(run);
                return (
                  <span
                    key={index}
                    className={`mini-game-life ${lost ? "mini-game-life--lost" : ""}`}
                    aria-hidden
                  />
                );
              })}
            </div>

            <div
              className={`mt-5 flex w-full max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-3 font-display text-white ${answerFontClass} ${
                flash === "bad" ? "mini-game-shake" : ""
              }`}
              aria-label={letters.join("")}
            >
              {words.map((word, wordIndex) => (
                <span
                  key={`word-${wordIndex}`}
                  className="inline-flex max-w-full shrink-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap"
                >
                  {word.map((char, index) => {
                    const empty = char === "_";
                    const hit = flash === "good" && !empty;
                    return (
                      <span
                        key={`${char}-${wordIndex}-${index}`}
                        className={`mini-game-letter-slot ${
                          empty
                            ? "mini-game-letter-slot--empty"
                            : hit
                              ? "mini-game-letter-slot--hit"
                              : ""
                        }`}
                      >
                        {empty ? "?" : char}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>

            <div className="mx-auto mt-7 flex w-full max-w-md flex-col gap-1.5">
              {ROWS.map((row) => (
                <div key={row} className="flex w-full justify-center gap-1">
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
                        className={`hangman-key flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-lg border text-sm font-semibold ${
                          used
                            ? inAnswer
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                              : "border-white/5 bg-white/5 text-gray-500"
                            : "border-white/15 bg-black/35 text-white"
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
              <div className="mini-game-guess-card mt-6">
                <p className={TYPO.cardTitle}>
                  {run.status === "won" ? "Solved" : "Out of lives"}
                </p>
                <p className={`mt-2 ${TYPO.body}`}>{run.answer}</p>
                {eraMeta?.isHistoric && (
                  <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-gold">
                    Era · {eraMeta.year}
                  </p>
                )}
                <MiniGameEndActions
                  onPlayAgain={startPractice}
                  playAgainLabel="Play again"
                />
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
