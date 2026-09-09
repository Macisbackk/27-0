"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { getLocalDateKey } from "@/lib/mini-games/date";
import {
  findMiniGamePlayerById,
  formatMiniGamePlayerLabel,
  getWordlePlayerPool,
} from "@/lib/mini-games/players";
import {
  createWordleRun,
  recordWordleResult,
  remainingWordleGuesses,
  submitWordleGuess,
  WORDLE_MAX_GUESSES,
} from "@/lib/mini-games/wordle/engine";
import {
  loadWordleRun,
  loadWordleStats,
  saveWordleRun,
  saveWordleStats,
} from "@/lib/mini-games/wordle/storage";
import type {
  WordleGuess,
  WordleRun,
} from "@/lib/mini-games/wordle/types";
import {
  claimMiniGameReward,
  WORDLE_WIN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { Confetti } from "@/components/Confetti";
import {
  playMiniClue,
  playMiniIncorrect,
  playMiniSelect,
  playMiniWin,
} from "@/lib/mini-games/sound";

type WordleRunView = WordleRun & { payoutAwarded?: boolean };

function clueClass(match: boolean): string {
  return match
    ? "rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 ring-1 ring-emerald-400/40"
    : "text-gray-400";
}

function trendText(trend: "higher" | "lower" | "match"): string {
  if (trend === "match") return "=";
  return trend === "higher" ? "↑" : "↓";
}

function GuessRow({ guess, shake }: { guess: WordleGuess; shake?: boolean }) {
  return (
    <li
      className={`border border-white/10 bg-[#0c1210] px-3 py-3 ${
        shake ? "mini-game-shake ring-1 ring-red-400/40" : ""
      }`}
    >
      <p className={TYPO.playerNameSm}>{guess.name}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className={TYPO.keyLabel}>Nation</dt>
          <dd className={clueClass(guess.clues.nationality === "match")}>
            {guess.nationality}
          </dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Pos</dt>
          <dd className={clueClass(guess.clues.position === "match")}>
            {guess.positionLabel}
          </dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Club</dt>
          <dd className={clueClass(guess.clues.club === "match")}>{guess.club}</dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Rating</dt>
          <dd className={clueClass(guess.clues.rating === "match")}>
            {guess.rating} {trendText(guess.clues.rating)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function settleWordle(run: WordleRun): WordleRunView {
  if (run.status === "playing" || run.rewardClaimed) return run;
  const stats = recordWordleResult(loadWordleStats(), run);
  saveWordleStats(stats);
  triggerMiniGameAchievements({
    played: true,
    wordleWon: run.status === "won",
  });
  if (run.status !== "won") {
    return { ...run, rewardClaimed: true };
  }
  const payout = claimMiniGameReward(
    `wordle_win:${run.date}`,
    "Rugby League Wordle",
    WORDLE_WIN_REWARD
  );
  return { ...run, rewardClaimed: true, payoutAwarded: payout.awarded };
}

export function WordleGame() {
  const pool = useMemo(() => getWordlePlayerPool(), []);
  const [run, setRun] = useState<WordleRunView | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [stats, setStats] = useState(() => ({
    currentStreak: 0,
    bestStreak: 0,
    wins: 0,
  }));

  useEffect(() => {
    const today = getLocalDateKey();
    const stored = loadWordleRun();
    const next =
      stored && stored.date === today ? stored : createWordleRun(today, pool);
    const settled =
      next.status !== "playing" && !next.rewardClaimed ? settleWordle(next) : next;
    saveWordleRun(settled);
    setRun(settled);
    setStats(loadWordleStats());
    triggerMiniGameAchievements({ played: true });
    setReady(true);
  }, [pool]);

  const answer = run ? findMiniGamePlayerById(run.answerId, pool) : undefined;

  const submit = (text: string) => {
    if (!run) return;
    playMiniSelect();
    const result = submitWordleGuess(run, text, pool);
    if (result.error) {
      setError(result.error);
      playMiniIncorrect();
      return;
    }
    setError(null);
    setQuery("");
    if (result.newlyFound && result.newlyFound.length > 0) {
      playMiniClue();
    }
    const next =
      result.run.status === "playing" ? result.run : settleWordle(result.run);
    saveWordleRun(next);
    setRun(next);
    setStats(loadWordleStats());
    const last = next.guesses[next.guesses.length - 1];
    if (next.status === "won") {
      playMiniWin();
      setCelebrate(true);
    } else if (last) {
      const anyMatch =
        last.clues.nationality === "match" ||
        last.clues.position === "match" ||
        last.clues.club === "match" ||
        last.clues.rating === "match";
      if (!anyMatch) {
        setShakeId(last.playerId);
        playMiniIncorrect();
        window.setTimeout(() => setShakeId(null), 400);
      }
    }
  };

  return (
    <MiniGameShell title="Rugby League Wordle">
      {celebrate && <Confetti />}
      <div className="mx-auto w-full max-w-lg">
        <p className={`mt-2 text-center ${TYPO.pageSubtitle}`}>
          Guess today&apos;s Super League player. Matching attributes unlock
          numbered clues.
        </p>
        <div className="text-center">
          <MiniGameStatLine
            items={[
              {
                label: "Guesses left",
                value: run ? remainingWordleGuesses(run) : WORDLE_MAX_GUESSES,
              },
              { label: "Streak", value: stats.currentStreak },
              { label: "Best", value: stats.bestStreak },
            ]}
          />
        </div>

        {!ready || !run ? (
          <p className={`mt-6 text-center ${TYPO.meta}`}>
            Loading today&apos;s player…
          </p>
        ) : (
          <>
            {run.discoveredClues.length > 0 && (
              <ul className="mt-5 flex flex-wrap justify-center gap-2">
                {run.discoveredClues.map((clue) => (
                  <li
                    key={clue.key}
                    className="mini-game-clue rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300"
                  >
                    Clue {clue.order} — {clue.label} ✓
                  </li>
                ))}
              </ul>
            )}

            {run.status === "playing" && (
              <form
                className="mt-6 flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(query);
                }}
              >
                <div className="min-w-0 flex-1">
                  <PlayerAutocomplete
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      setError(null);
                    }}
                    onPick={(player) => {
                      setQuery(player.displayName);
                      submit(player.id);
                    }}
                    pool={pool}
                  />
                </div>
                <GameButton
                  type="submit"
                  size="sm"
                  fullWidth={false}
                  className="shrink-0"
                >
                  Guess
                </GameButton>
              </form>
            )}
            {error && (
              <p className="mt-2 text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <ul className="mt-6 space-y-2">
              {run.guesses.map((guess) => (
                <GuessRow
                  key={guess.playerId}
                  guess={guess}
                  shake={shakeId === guess.playerId}
                />
              ))}
            </ul>

            {run.status !== "playing" && answer && (
              <div
                className={`mt-6 border border-white/10 bg-[#0c1210] px-4 py-4 text-center ${
                  celebrate ? "ring-1 ring-emerald-400/50" : ""
                }`}
              >
                <p className={TYPO.cardTitle}>
                  {run.status === "won" ? "Got it" : "Unlucky"}
                </p>
                <p className={`mt-2 ${TYPO.body}`}>
                  {formatMiniGamePlayerLabel(answer)}
                  {" · "}
                  {answer.club}
                  {" · "}
                  {answer.positionLabel}
                  {" · "}
                  {answer.rating}
                </p>
                {run.status === "won" && run.payoutAwarded && (
                  <p className={`mt-2 ${TYPO.bodySm}`}>
                    +{formatClubFundsExact(WORDLE_WIN_REWARD)} Club Funds
                  </p>
                )}
                <p className={`mt-3 ${TYPO.bodySm}`}>
                  Come back tomorrow for a new player.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
