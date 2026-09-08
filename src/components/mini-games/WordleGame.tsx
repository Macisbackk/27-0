"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { playUiClick } from "@/lib/sound";
import { getLocalDateKey } from "@/lib/mini-games/date";
import { getWordlePlayerPool } from "@/lib/mini-games/players";
import {
  createWordleRun,
  recordWordleResult,
  remainingWordleGuesses,
  submitWordleGuess,
  WORDLE_MAX_GUESSES,
} from "@/lib/mini-games/wordle/engine";
import { loadWordleRun, loadWordleStats, saveWordleRun, saveWordleStats } from "@/lib/mini-games/wordle/storage";
import type { WordleGuess, WordleRun } from "@/lib/mini-games/wordle/types";
import {
  claimMiniGameReward,
  WORDLE_WIN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { formatMiniGamePlayerLabel, findMiniGamePlayerById } from "@/lib/mini-games/players";

function clueClass(match: boolean): string {
  return match ? "text-emerald-400" : "text-gray-400";
}

function trendText(trend: "higher" | "lower" | "match"): string {
  if (trend === "match") return "=";
  return trend === "higher" ? "↑" : "↓";
}

function GuessRow({ guess }: { guess: WordleGuess }) {
  return (
    <li className="border border-white/10 bg-[#0c1210] px-3 py-3">
      <p className={TYPO.playerNameSm}>{guess.name}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-5">
        <div>
          <dt className={TYPO.keyLabel}>Club</dt>
          <dd className={clueClass(guess.clues.club === "match")}>{guess.club}</dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Pos</dt>
          <dd className={clueClass(guess.clues.position === "match")}>
            {guess.positionLabel}
          </dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Nation</dt>
          <dd className={clueClass(guess.clues.nationality === "match")}>
            {guess.nationality}
          </dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Rating</dt>
          <dd className={clueClass(guess.clues.rating === "match")}>
            {guess.rating} {trendText(guess.clues.rating)}
          </dd>
        </div>
        <div>
          <dt className={TYPO.keyLabel}>Year</dt>
          <dd className={clueClass(guess.clues.year === "match")}>
            {guess.year} {trendText(guess.clues.year)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

type WordleRunView = WordleRun & { payoutAwarded?: boolean };

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
    playUiClick();
    const result = submitWordleGuess(run, text, pool);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setQuery("");
    const next =
      result.run.status === "playing" ? result.run : settleWordle(result.run);
    saveWordleRun(next);
    setRun(next);
    setStats(loadWordleStats());
  };

  return (
    <MiniGameShell title="Rugby League Wordle">
      <p className={`mt-2 ${TYPO.pageSubtitle}`}>
        Guess today&apos;s rugby league player. {WORDLE_MAX_GUESSES} guesses.
        Green is a match. Arrows show whether the answer is higher or lower.
      </p>
      <MiniGameStatLine
        items={[
          { label: "Guesses left", value: run ? remainingWordleGuesses(run) : WORDLE_MAX_GUESSES },
          { label: "Streak", value: stats.currentStreak },
          { label: "Best", value: stats.bestStreak },
        ]}
      />

      {!ready || !run ? (
        <p className={`mt-6 ${TYPO.meta}`}>Loading today&apos;s player…</p>
      ) : (
        <>
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
              <GameButton type="submit" size="sm" fullWidth={false} className="shrink-0">
                Guess
              </GameButton>
            </form>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <ul className="mt-6 space-y-2">
            {run.guesses.map((guess) => (
              <GuessRow key={guess.playerId} guess={guess} />
            ))}
          </ul>

          {run.status !== "playing" && answer && (
            <div className="mt-6 border border-white/10 bg-[#0c1210] px-4 py-4 text-center">
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
              <p className={`mt-3 ${TYPO.bodySm}`}>Come back tomorrow for a new player.</p>
            </div>
          )}
        </>
      )}
    </MiniGameShell>
  );
}
