"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine, MiniGameEndActions } from "./MiniGameShell";
import { MiniGamePoolSelect } from "./MiniGamePoolSelect";
import { MiniGameRewardPopup } from "./MiniGameRewardPopup";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import { TYPO } from "@/lib/ui/typography";
import {
  findMiniGamePlayerById,
  formatMiniGamePlayerLabel,
  getWordlePlayerPool,
} from "@/lib/mini-games/players";
import {
  isMiniGamePoolMode,
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";
import {
  createWordleRun,
  recordWordleResult,
  remainingWordleGuesses,
  submitWordleGuess,
  useWordleHint,
  WORDLE_ATTRIBUTE_COUNT,
  WORDLE_MAX_GUESSES,
  wordleStatusLabel,
} from "@/lib/mini-games/wordle/engine";
import {
  clearWordleRun,
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
type View = "select" | "play";

function trendText(trend: "higher" | "lower" | "match"): string {
  if (trend === "match") return "=";
  return trend === "higher" ? "↑" : "↓";
}

function GuessRow({ guess, shake }: { guess: WordleGuess; shake?: boolean }) {
  const tiles: {
    label: string;
    value: string;
    match: boolean;
  }[] = [
    {
      label: "Status",
      value: wordleStatusLabel(guess.isHistoric),
      match: guess.clues.status === "match",
    },
    {
      label: "Nation",
      value: guess.nationality,
      match: guess.clues.nationality === "match",
    },
    {
      label: "Pos",
      value: guess.positionLabel,
      match: guess.clues.position === "match",
    },
    {
      label: "Club",
      value: guess.club,
      match: guess.clues.club === "match",
    },
    {
      label: "Age",
      value: `${guess.age} ${trendText(guess.clues.age)}`,
      match: guess.clues.age === "match",
    },
    {
      label: "Rating",
      value: `${guess.rating} ${trendText(guess.clues.rating)}`,
      match: guess.clues.rating === "match",
    },
  ];

  return (
    <li
      className={`mini-game-guess-card ${
        shake ? "mini-game-shake ring-1 ring-red-400/40" : ""
      }`}
    >
      <p className={TYPO.playerNameSm}>{guess.name}</p>
      <div className="mini-game-attr-grid">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`mini-game-attr-tile ${
              tile.match ? "mini-game-attr-tile--match" : "mini-game-attr-tile--miss"
            }`}
          >
            <span className="mini-game-attr-tile__label">{tile.label}</span>
            <span className="mini-game-attr-tile__value">{tile.value}</span>
          </div>
        ))}
      </div>
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
  const [view, setView] = useState<View>("select");
  const [poolMode, setPoolMode] = useState<MiniGamePoolMode | null>(null);
  const [run, setRun] = useState<WordleRunView | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [stats, setStats] = useState(() => ({
    currentStreak: 0,
    bestStreak: 0,
    wins: 0,
  }));

  const pool = useMemo(
    () => getWordlePlayerPool(poolMode ?? undefined),
    [poolMode]
  );

  useEffect(() => {
    const stored = loadWordleRun();
    setStats(loadWordleStats());
    if (
      stored &&
      stored.status === "playing" &&
      isMiniGamePoolMode(stored.poolMode)
    ) {
      setPoolMode(stored.poolMode);
      setRun(stored);
    }
    setReady(true);
  }, []);

  const answer = run ? findMiniGamePlayerById(run.answerId, pool) : undefined;
  const hasResume =
    Boolean(run) &&
    run?.status === "playing" &&
    isMiniGamePoolMode(run.poolMode);

  const startMode = (mode: MiniGamePoolMode) => {
    const stored = loadWordleRun();
    if (
      stored &&
      stored.status === "playing" &&
      stored.poolMode === mode
    ) {
      setPoolMode(mode);
      setRun(stored);
      setView("play");
      return;
    }
    const nextPool = getWordlePlayerPool(mode);
    const next = createWordleRun(nextPool, undefined, mode);
    saveWordleRun(next);
    setPoolMode(mode);
    setRun(next);
    setQuery("");
    setError(null);
    setShakeId(null);
    setCelebrate(false);
    setRewardOpen(false);
    setView("play");
    triggerMiniGameAchievements({ played: true });
  };

  const resume = () => {
    if (!run || !isMiniGamePoolMode(run.poolMode)) return;
    setPoolMode(run.poolMode);
    setView("play");
  };

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
    const next: WordleRunView =
      result.run.status === "playing"
        ? result.run
        : settleWordle(result.run);
    saveWordleRun(next);
    setRun(next);
    setStats(loadWordleStats());
    const last = next.guesses[next.guesses.length - 1];
    if (next.status === "won") {
      playMiniWin();
      setCelebrate(true);
      if (next.payoutAwarded) setRewardOpen(true);
    } else if (last) {
      const anyMatch =
        last.clues.status === "match" ||
        last.clues.nationality === "match" ||
        last.clues.position === "match" ||
        last.clues.club === "match" ||
        last.clues.age === "match" ||
        last.clues.rating === "match";
      if (!anyMatch) {
        setShakeId(last.playerId);
        playMiniIncorrect();
        window.setTimeout(() => setShakeId(null), 400);
      }
    }
  };

  const revealClue = () => {
    if (!run || run.status !== "playing") return;
    playMiniSelect();
    const result = useWordleHint(run, pool);
    if (result.error) {
      setError(result.error);
      playMiniIncorrect();
      return;
    }
    setError(null);
    playMiniClue();
    saveWordleRun(result.run);
    setRun(result.run);
  };

  const restart = () => {
    if (!poolMode) {
      clearWordleRun();
      setRun(null);
      setView("select");
      return;
    }
    playMiniSelect();
    clearWordleRun();
    const next = createWordleRun(pool, undefined, poolMode);
    saveWordleRun(next);
    setRun(next);
    setQuery("");
    setError(null);
    setShakeId(null);
    setCelebrate(false);
    setRewardOpen(false);
    setStats(loadWordleStats());
  };

  const canUseHint =
    run?.status === "playing" &&
    !run.hintUsed &&
    !run.answerHint &&
    run.discoveredClues.length < WORDLE_ATTRIBUTE_COUNT;

  if (!ready) {
    return (
      <MiniGameShell title="Rugby League Wordle">
        <p className={`mt-6 text-center ${TYPO.meta}`}>Loading…</p>
      </MiniGameShell>
    );
  }

  if (view === "select") {
    return (
      <MiniGameShell
        eyebrow="Rugby League Wordle"
        title="Choose Current or Era"
      >
        <MiniGamePoolSelect
          subtitle="Guess a Super League player from today’s game or from the eras."
          onSelect={startMode}
          resumeLabel={hasResume ? "Resume Wordle" : undefined}
          onResume={hasResume ? resume : undefined}
        />
      </MiniGameShell>
    );
  }

  return (
    <MiniGameShell title="Rugby League Wordle">
      {celebrate && <Confetti />}
      <MiniGameRewardPopup
        open={rewardOpen}
        amount={WORDLE_WIN_REWARD}
        detail="Reward for solving this Wordle."
        onClose={() => setRewardOpen(false)}
      />
      <div className="mini-game-play mx-auto flex w-full max-w-lg flex-col items-center">
        <p className={`mt-2 text-center ${TYPO.pageSubtitle}`}>
          {poolMode
            ? `${MINI_GAME_POOL_MODE_LABEL[poolMode]} pool — matching attributes go green.`
            : "Guess the Super League player. Matching attributes go green."}
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

        {!run ? (
          <p className={`mt-6 text-center ${TYPO.meta}`}>Loading player…</p>
        ) : (
          <>
            {(run.discoveredClues.length > 0 || run.answerHint) && (
              <ul className="mt-5 flex flex-wrap justify-center gap-2">
                {run.answerHint ? (
                  <li className="mini-game-clue rounded-md border border-accent-gold/40 bg-accent-gold/15 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-gold">
                    Reveal — {run.answerHint.label}: {run.answerHint.value}
                  </li>
                ) : null}
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
                className="mt-6 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(query);
                }}
              >
                <div className="min-w-0 flex-1 text-left">
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
                  className="mx-auto shrink-0 sm:mx-0"
                >
                  Guess
                </GameButton>
              </form>
            )}

            {canUseHint ? (
              <div className="mt-3 w-full max-w-xs">
                <GameButton
                  variant="secondary"
                  size="sm"
                  onClick={revealClue}
                >
                  Reveal one clue
                </GameButton>
                <p className={`mt-1.5 text-center ${TYPO.meta}`}>
                  Once per round — status, nation, position, club, or rating.
                </p>
              </div>
            ) : null}

            {error && (
              <p className="mt-2 text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <ul className="mt-6 w-full space-y-2">
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
                className={`mini-game-guess-card mt-6 ${
                  celebrate ? "ring-1 ring-emerald-400/50" : ""
                }`}
              >
                <p className={TYPO.cardTitle}>
                  {run.status === "won" ? "Got it" : "Unlucky"}
                </p>
                <p className={`mt-2 ${TYPO.body}`}>
                  {formatMiniGamePlayerLabel(answer)}
                  {" · "}
                  {wordleStatusLabel(answer.isHistoric)}
                  {" · "}
                  {answer.club}
                  {" · "}
                  {answer.positionLabel}
                  {" · "}
                  {answer.age}
                  {" · "}
                  {answer.rating}
                </p>
                <MiniGameEndActions onPlayAgain={restart} />
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
