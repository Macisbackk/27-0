"use client";

import { getLocalDateKey } from "@/lib/mini-games/date";
import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine, MiniGameEndActions } from "./MiniGameShell";
import { MiniGameRewardPopup } from "./MiniGameRewardPopup";
import { DailyMissionToast } from "@/components/DailyMissionToast";
import { reportMissionEvent } from "@/lib/daily-missions";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import { TYPO } from "@/lib/ui/typography";
import {
  findMiniGamePlayerById,
  formatMiniGamePlayerLabel,
  getWordlePlayerPool,
} from "@/lib/mini-games/players";
import {
  MINI_GAME_POOL_MODE_LABEL,
  type MiniGamePoolMode,
} from "@/lib/mini-games/pool-mode";
import {
  createWordleRun,
  recordWordleResult,
  remainingWordleGuesses,
  submitWordleGuess,
  buildWordleShareText,
  useWordleHint,
  WORDLE_ATTRIBUTE_COUNT,
  WORDLE_MAX_GUESSES,
} from "@/lib/mini-games/wordle/engine";
import {
  clearWordleRun,
  loadWordleStats,
  saveWordleRun,
  saveWordleStats,
} from "@/lib/mini-games/wordle/storage";
import type {
  WordleGuess,
  WordleRun,
} from "@/lib/mini-games/wordle/types";
import { syncMiniGameWins } from "@/lib/storage/mini-games-leaderboard";
import {
  claimMiniGameReward,
  WORDLE_WIN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { getPaidRunIds } from "@/lib/storage/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { Confetti } from "@/components/Confetti";
import {
  playMiniClue,
  playMiniIncorrect,
  playMiniSelect,
  playMiniWin,
} from "@/lib/mini-games/sound";

type WordleRunView = WordleRun & { payoutAwarded?: boolean };
const WORDLE_MODES: MiniGamePoolMode[] = ["current", "era"];

type TileState = "match" | "close" | "miss" | "higher" | "lower";

const TILE_SYMBOL: Record<TileState, string> = {
  match: "✓",
  close: "~",
  miss: "✗",
  higher: "↑",
  lower: "↓",
};

/** Screen-reader / legend wording for each tile state. */
function tileStateText(state: TileState, label: string): string {
  switch (state) {
    case "match":
      return "correct";
    case "close":
      return "close (same unit)";
    case "miss":
      return "wrong";
    case "higher":
      return label === "Era" ? "answer is from a later decade" : `answer is higher`;
    case "lower":
      return label === "Era" ? "answer is from an earlier decade" : `answer is lower`;
  }
}

function tileClass(state: TileState): string {
  if (state === "match") return "mini-game-attr-tile--match";
  if (state === "close") return "mini-game-attr-tile--miss ring-2 ring-inset ring-amber-400/70";
  return "mini-game-attr-tile--miss";
}

function GuessRow({ guess, shake, showEra }: { guess: WordleGuess; shake?: boolean; showEra: boolean }) {
  const tiles: { label: string; value: string; state: TileState }[] = [
    { label: "Club", value: guess.club, state: guess.clues.club as TileState },
    { label: "Pos", value: guess.positionLabel, state: guess.clues.position as TileState },
    { label: "Nation", value: guess.nationality, state: guess.clues.nationality as TileState },
    {
      label: "Age",
      value: String(guess.age),
      state: guess.clues.age === "match" ? "match" : guess.clues.age,
    },
    {
      label: "Rating",
      value: String(guess.rating),
      state: guess.clues.rating === "match" ? "match" : guess.clues.rating,
    },
  ];
  if (showEra && guess.clues.era && guess.eraLabel) {
    tiles.push({
      label: "Era",
      value: guess.eraLabel,
      state: guess.clues.era === "match" ? "match" : guess.clues.era,
    });
  }

  return (
    <li
      className={`mini-game-guess-card ${
        shake ? "mini-game-shake ring-1 ring-red-400/40" : ""
      }`}
    >
      <p className={TYPO.playerNameSm}>{guess.name}</p>
      <ul className="mini-game-attr-grid" aria-label={`Feedback for ${guess.name}`}>
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className={`mini-game-attr-tile ${tileClass(tile.state)}`}
            data-state={tile.state}
          >
            <span className="mini-game-attr-tile__label">{tile.label}</span>
            <span className="mini-game-attr-tile__value">
              {tile.value}{" "}
              <span aria-hidden="true" className="font-bold">
                {TILE_SYMBOL[tile.state]}
              </span>
              <span className="sr-only">
                {`, ${tileStateText(tile.state, tile.label)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** One-line legend: shapes as well as colours. */
function WordleLegend({ showEra }: { showEra: boolean }) {
  return (
    <p className={`mt-3 text-center ${TYPO.meta}`} aria-label="How to read the tiles">
      <span className="whitespace-nowrap">✓ green = match</span>
      {" · "}
      <span className="whitespace-nowrap">~ amber edge = same unit</span>
      {" · "}
      <span className="whitespace-nowrap">✗ = no match</span>
      {" · "}
      <span className="whitespace-nowrap">↑ ↓ = answer is higher / lower</span>
      {showEra ? (
        <>
          {" · "}
          <span className="whitespace-nowrap">Era = decade</span>
        </>
      ) : null}
    </p>
  );
}

/** Club Funds ledger id for today's Wordle win (one paid win per UK day, any mode). */
function wordleRewardId(): string {
  return `wordle_win:${getLocalDateKey()}`;
}

function settleWordle(run: WordleRun): WordleRunView {
  if (run.status === "playing" || run.rewardClaimed) return run;
  const stats = recordWordleResult(loadWordleStats(), run);
  saveWordleStats(stats);
  syncMiniGameWins("wordle", stats.wins);
  triggerMiniGameAchievements({
    played: true,
    wordleWon: run.status === "won",
  });
  reportMissionEvent({ kind: "wordle", won: run.status === "won" });
  if (run.status !== "won") {
    return { ...run, rewardClaimed: true };
  }
  const payout = claimMiniGameReward(
    // Once per UK day: run.date is a fresh id on every "Play again", so keying on it paid every win.
    wordleRewardId(),
    "Rugby League Wordle",
    WORDLE_WIN_REWARD
  );
  return { ...run, rewardClaimed: true, payoutAwarded: payout.awarded };
}

export function WordleGame() {
  // v1.18: no mode step. Current is the default; Era is a toggle in the header.
  const [poolMode, setPoolMode] = useState<MiniGamePoolMode>("current");
  const [rewardBankedToday, setRewardBankedToday] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
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

  const pool = useMemo(() => getWordlePlayerPool(poolMode), [poolMode]);

  useEffect(() => {
    clearWordleRun();
    setStats(loadWordleStats());
    setRewardBankedToday(getPaidRunIds().includes(wordleRewardId()));
    const first = createWordleRun(getWordlePlayerPool("current"), undefined, "current");
    saveWordleRun(first);
    setRun(first);
    setReady(true);
  }, []);

  const answer = run ? findMiniGamePlayerById(run.answerId, pool) : undefined;

  const startMode = (mode: MiniGamePoolMode) => {
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
    setShareNote(null);
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
    // "Puzzle Starter" fires on the first submitted guess, not on opening the page.
    if (run.guesses.length === 0) triggerMiniGameAchievements({ played: true });
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
      setRewardBankedToday(getPaidRunIds().includes(wordleRewardId()));
    } else if (last) {
      const anyMatch =
        last.clues.nationality === "match" ||
        last.clues.position !== "miss" ||
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

  const share = async () => {
    if (!run) return;
    const text = buildWordleShareText(run, MINI_GAME_POOL_MODE_LABEL[poolMode]);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote("Result copied.");
    } catch {
      setShareNote("Couldn't share right now.");
    }
  };

  const restart = () => {
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
    setShareNote(null);
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

  const showEra = poolMode === "era";
  const switchMode = (mode: MiniGamePoolMode) => {
    if (mode === poolMode) return;
    playMiniSelect();
    startMode(mode);
  };

  return (
    <MiniGameShell title="Rugby League Wordle">
      {celebrate && <Confetti />}
      <DailyMissionToast />
      <MiniGameRewardPopup
        open={rewardOpen}
        amount={WORDLE_WIN_REWARD}
        detail="One reward per day. Resets at midnight UK time."
        onClose={() => setRewardOpen(false)}
      />
      <div className="mini-game-play mx-auto flex w-full max-w-lg flex-col items-center">
        <div
          className="pitch-seg pitch-seg--on-dark mb-3 w-full max-w-[16rem]"
          role="group"
          aria-label="Player pool"
        >
          {WORDLE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={poolMode === mode}
              onClick={() => switchMode(mode)}
              data-tone={mode === "era" ? "era" : undefined}
            >
              {MINI_GAME_POOL_MODE_LABEL[mode]}
            </button>
          ))}
        </div>
        <p className={`mb-2 text-center ${TYPO.meta}`} data-testid="wordle-reward-line">
          {rewardBankedToday
            ? `Today's ${formatClubFunds(WORDLE_WIN_REWARD)} is banked. Play on for fun and your streak.`
            : `${formatClubFunds(WORDLE_WIN_REWARD)} today for your first win (Current or Era).`}
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
                <div className="min-w-0 flex-1 text-center">
                  <PlayerAutocomplete
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      setError(null);
                    }}
                    onPick={(player) => {
                      // One tap per guess: picking a suggestion submits it.
                      setError(null);
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
              <div className="mt-2 flex w-full justify-end">
                <GameButton
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  className="!min-h-0 !px-2 !py-1 text-[11px] font-medium text-pitch-400 hover:text-pitch-200"
                  onClick={revealClue}
                >
                  Reveal a clue (free, marked on your share)
                </GameButton>
              </div>
            ) : null}

            <WordleLegend showEra={showEra} />

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
                  showEra={showEra}
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
                  {` · ${MINI_GAME_POOL_MODE_LABEL[poolMode]}`}
                  {" · "}
                  {answer.club}
                  {" · "}
                  {answer.positionLabel}
                  {" · "}
                  {answer.age}
                  {" · "}
                  {answer.rating}
                </p>
                <div className="mt-3 flex flex-col items-center gap-1">
                  <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => void share()}>
                    Share result{run.hintUsed ? " (hint used)" : ""}
                  </GameButton>
                  {shareNote ? <p className={TYPO.meta} role="status">{shareNote}</p> : null}
                </div>
                <MiniGameEndActions onPlayAgain={restart} />
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
