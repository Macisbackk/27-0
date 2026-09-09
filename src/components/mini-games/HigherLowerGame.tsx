"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine, MiniGameEndActions } from "./MiniGameShell";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import {
  formatMiniGamePlayerLabel,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "@/lib/mini-games/players";
import {
  advanceHigherLower,
  answerHigherLower,
  applyHigherLowerPick,
  applyHigherLowerRunEnd,
  createHigherLowerRun,
  HIGHER_LOWER_PICKS,
  higherLowerPickNumber,
  isFinalHigherLowerPick,
  resolveHigherLowerPlayers,
} from "@/lib/mini-games/higher-lower/engine";
import {
  clearHigherLowerRun,
  loadHigherLowerRun,
  loadHigherLowerStats,
  saveHigherLowerRun,
  saveHigherLowerStats,
} from "@/lib/mini-games/higher-lower/storage";
import type {
  HigherLowerChoice,
  HigherLowerRun,
  HigherLowerStats,
} from "@/lib/mini-games/higher-lower/types";
import {
  claimMiniGameReward,
  HIGHER_LOWER_FIVE_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { Confetti } from "@/components/Confetti";
import {
  playMiniCorrect,
  playMiniLose,
  playMiniMilestone,
  playMiniReveal,
  playMiniSelect,
  playMiniWin,
} from "@/lib/mini-games/sound";

type PayoutNote = string | null;

function settleWin(
  run: HigherLowerRun,
  stats: HigherLowerStats
): { run: HigherLowerRun; stats: HigherLowerStats; note: PayoutNote } {
  const ended = applyHigherLowerRunEnd(stats, true);
  if (run.rewardClaimed) {
    return { run, stats: ended, note: null };
  }
  const payout = claimMiniGameReward(
    `hol_five:${run.seed}`,
    "Higher or Lower — 5 picks complete",
    HIGHER_LOWER_FIVE_REWARD
  );
  const nextStats = payout.awarded
    ? { ...ended, lastRewardedRunId: run.seed }
    : ended;
  return {
    run: { ...run, rewardClaimed: true },
    stats: nextStats,
    note: payout.awarded
      ? `+${formatClubFundsExact(HIGHER_LOWER_FIVE_REWARD)} for 5 picks complete`
      : null,
  };
}

function PlayerFace({
  player,
  showRating,
  label,
  hint,
}: {
  player: MiniGamePlayer;
  showRating: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[16rem] border border-white/10 bg-[#0c1210] px-4 py-4 text-center">
      <p className={TYPO.keyLabel}>{label}</p>
      {hint ? <p className={`mt-1 ${TYPO.meta}`}>{hint}</p> : null}
      <div className="mt-3 flex justify-center">
        <ClubLogoBox club={player.club} size="md" showAbbrev={false} />
      </div>
      <p className={`mt-3 ${TYPO.playerNameSm}`}>
        {formatMiniGamePlayerLabel(player)}
      </p>
      {player.isHistoric ? (
        <p
          className={`mt-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-gold`}
          aria-label={`Era player from ${player.year}`}
        >
          Era · {player.year}
        </p>
      ) : (
        <p className={`mt-1.5 ${TYPO.meta}`}>Current</p>
      )}
      <p
        className={`mt-3 font-display text-3xl tabular-nums ${
          showRating ? "text-white" : "text-pitch-600"
        }`}
        aria-label={showRating ? `Rating ${player.rating}` : "Rating hidden"}
      >
        {showRating ? player.rating : "?"}
      </p>
      {!showRating ? (
        <p className={`mt-1 ${TYPO.meta}`}>Rating hidden</p>
      ) : (
        <p className={`mt-1 ${TYPO.meta}`}>Rating</p>
      )}
    </div>
  );
}

export function HigherLowerGame() {
  const pool = useMemo(() => getHigherLowerPlayerPool(), []);
  const [run, setRun] = useState<HigherLowerRun | null>(null);
  const [stats, setStats] = useState<HigherLowerStats | null>(null);
  const [note, setNote] = useState<PayoutNote>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => {
    const storedStats = loadHigherLowerStats();
    const storedRun = loadHigherLowerRun();
    const nextRun =
      storedRun && storedRun.status === "playing"
        ? storedRun
        : createHigherLowerRun(pool);
    saveHigherLowerRun(nextRun);
    setRun(nextRun);
    setStats(storedStats);
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: storedStats.bestStreak,
      higherLowerFivePickWins: storedStats.fivePickWins,
    });
    setReady(true);
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, [pool]);

  const board = run ? resolveHigherLowerPlayers(run, pool) : null;

  const persist = (nextRun: HigherLowerRun, nextStats: HigherLowerStats) => {
    saveHigherLowerRun(nextRun);
    saveHigherLowerStats(nextStats);
    setRun(nextRun);
    setStats(nextStats);
  };

  const pick = (choice: HigherLowerChoice) => {
    if (!run || !stats || run.revealed || run.status !== "playing") return;
    playMiniSelect();
    const result = answerHigherLower(run, choice, pool);
    playMiniReveal();
    let nextStats = applyHigherLowerPick(stats, result.correct);
    let nextRun = result.run;
    let payout: PayoutNote = null;

    if (result.correct && nextRun.status === "won") {
      const settled = settleWin(nextRun, nextStats);
      nextRun = settled.run;
      nextStats = settled.stats;
      payout = settled.note;
      playMiniCorrect();
      playMiniWin();
      if (payout) playMiniMilestone();
      setCelebrate(true);
    } else if (result.correct) {
      playMiniCorrect();
    } else {
      nextStats = applyHigherLowerRunEnd(nextStats, false);
      playMiniLose();
    }

    persist(nextRun, nextStats);
    setNote(payout);
    setFlash(result.correct ? "good" : "bad");
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: nextStats.bestStreak,
      higherLowerFivePickWins: nextStats.fivePickWins,
    });

    if (result.correct && nextRun.status === "playing") {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      const snapshot = nextRun;
      advanceTimer.current = window.setTimeout(() => {
        setRun((current) => {
          if (!current || current.seed !== snapshot.seed) return current;
          if (current.status !== "playing" || !current.lastCorrect) return current;
          playMiniSelect();
          const advanced = advanceHigherLower(current, pool);
          saveHigherLowerRun(advanced);
          setFlash(null);
          setNote(null);
          return advanced;
        });
      }, 1100);
    }
  };

  const continueRun = () => {
    if (!run || !run.lastCorrect || run.status !== "playing") return;
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    playMiniSelect();
    const next = advanceHigherLower(run, pool);
    saveHigherLowerRun(next);
    setRun(next);
    setNote(null);
    setFlash(null);
  };

  const restart = () => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    playMiniSelect();
    clearHigherLowerRun();
    const next = createHigherLowerRun(pool);
    saveHigherLowerRun(next);
    setRun(next);
    setNote(null);
    setFlash(null);
    setCelebrate(false);
  };

  const pickNumber = run ? higherLowerPickNumber(run) : 1;
  const challengeRevealed = Boolean(run?.revealed);
  const runOver = run?.status === "won" || run?.status === "lost";

  return (
    <MiniGameShell title="Higher or Lower">
      {celebrate && <Confetti />}
      <div className="mini-game-play mx-auto flex w-full max-w-sm flex-col items-center">
        <p className={`mt-2 text-center ${TYPO.pageSubtitle}`}>
          Compare ratings. The top player&apos;s score is shown — guess if the
          bottom player is higher or lower.
        </p>
        <div className="text-center">
          <MiniGameStatLine
            items={[
              { label: "Wins", value: stats?.fivePickWins ?? 0 },
              { label: "Best", value: stats?.bestStreak ?? 0 },
            ]}
          />
        </div>

        {!ready || !run || !board ? (
          <p className={`mt-6 text-center ${TYPO.meta}`}>Loading players…</p>
        ) : (
          <>
            <p className={`mt-5 text-center ${TYPO.keyLabel}`}>
              {run.status === "won"
                ? "5 PICKS COMPLETE"
                : `PICK ${pickNumber} / ${HIGHER_LOWER_PICKS}`}
            </p>

            {!run.revealed && run.status === "playing" ? (
              <p className={`mt-2 text-center ${TYPO.bodySm}`}>
                Is{" "}
                <span className="font-semibold text-white">
                  {formatMiniGamePlayerLabel(board.challenge)}
                </span>{" "}
                rated higher or lower than{" "}
                <span className="font-semibold text-white">
                  {board.base.rating}
                </span>
                ?
              </p>
            ) : null}

            <div
              className={`mt-4 w-full transition ${
                flash === "good"
                  ? "border border-emerald-400/40 bg-emerald-500/5"
                  : flash === "bad"
                    ? "mini-game-shake border border-red-400/40 bg-red-500/5"
                    : "border border-transparent"
              }`}
            >
              <PlayerFace
                player={board.base}
                showRating
                label="Known rating"
                hint="Compare against this"
              />
              <p className={`my-3 text-center ${TYPO.keyLabel}`}>VS</p>
              <PlayerFace
                player={board.challenge}
                showRating={challengeRevealed}
                label="Mystery rating"
                hint="Guess higher or lower"
              />
            </div>

            {challengeRevealed && (
              <p className={`mt-4 text-center ${TYPO.bodySm}`}>
                {formatMiniGamePlayerLabel(board.challenge, { showYear: true })}{" "}
                is{" "}
                <span className="font-semibold text-white">
                  {board.challenge.rating > board.base.rating
                    ? "HIGHER"
                    : "LOWER"}
                </span>{" "}
                ({board.challenge.rating} vs {board.base.rating})
              </p>
            )}

            {!run.revealed && run.status === "playing" && (
              <div className="mt-5 grid w-full gap-3">
                <p className={`text-center ${TYPO.meta}`}>
                  {formatMiniGamePlayerLabel(board.challenge)}&apos;s rating is…
                </p>
                <div className="grid w-full grid-cols-2 gap-3">
                  <GameButton variant="theme" onClick={() => pick("higher")}>
                    Higher
                  </GameButton>
                  <GameButton variant="secondary" onClick={() => pick("lower")}>
                    Lower
                  </GameButton>
                </div>
              </div>
            )}

            {run.revealed && (
              <div className="mt-6 w-full text-center">
                <p className={TYPO.cardTitle}>
                  {run.status === "won"
                    ? "5 picks complete"
                    : run.lastCorrect
                      ? "Correct"
                      : "Wrong"}
                </p>
                {note && <p className={`mt-2 ${TYPO.bodySm}`}>{note}</p>}
                <div className="mx-auto mt-4 w-full max-w-xs">
                  {run.status === "playing" &&
                  run.lastCorrect &&
                  !isFinalHigherLowerPick(run) ? (
                    <GameButton variant="theme" onClick={continueRun}>
                      Next pick
                    </GameButton>
                  ) : runOver ? (
                    <MiniGameEndActions onPlayAgain={restart} />
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
