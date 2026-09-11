"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine, MiniGameEndActions } from "./MiniGameShell";
import { MiniGamePoolSelect, MiniGamePoolSelectTitle } from "./MiniGamePoolSelect";
import { MiniGameRewardPopup } from "./MiniGameRewardPopup";
import { TYPO } from "@/lib/ui/typography";
import {
  formatMiniGamePlayerLabel,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "@/lib/mini-games/players";
import type { MiniGamePoolMode } from "@/lib/mini-games/pool-mode";
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

type View = "select" | "play";

function settleWin(
  run: HigherLowerRun,
  stats: HigherLowerStats
): { run: HigherLowerRun; stats: HigherLowerStats; awarded: boolean } {
  const ended = applyHigherLowerRunEnd(stats, true);
  if (run.rewardClaimed) {
    return { run, stats: ended, awarded: false };
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
    awarded: payout.awarded,
  };
}

function PlayerFace({
  player,
  showRating,
}: {
  player: MiniGamePlayer;
  showRating: boolean;
}) {
  return (
    <div className="hol-face">
      <div className="flex justify-center">
        <ClubLogoBox club={player.club} size="sm" showAbbrev={false} />
      </div>
      <p className={`mt-1.5 truncate ${TYPO.playerNameSm}`}>
        {formatMiniGamePlayerLabel(player)}
      </p>
      <p className={`mt-0.5 ${TYPO.meta}`}>
        {player.isHistoric ? `Era · ${player.year}` : "Current"}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl tabular-nums leading-none ${
          showRating ? "text-white" : "text-pitch-600"
        }`}
        aria-label={showRating ? `Rating ${player.rating}` : "Rating hidden"}
      >
        {showRating ? player.rating : "?"}
      </p>
    </div>
  );
}

export function HigherLowerGame() {
  const [view, setView] = useState<View>("select");
  const [poolMode, setPoolMode] = useState<MiniGamePoolMode | null>(null);
  const [run, setRun] = useState<HigherLowerRun | null>(null);
  const [stats, setStats] = useState<HigherLowerStats | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  const pool = useMemo(
    () => getHigherLowerPlayerPool(poolMode ?? undefined),
    [poolMode]
  );

  useEffect(() => {
    clearHigherLowerRun();
    setStats(loadHigherLowerStats());
    setReady(true);
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  const board = run ? resolveHigherLowerPlayers(run, pool) : null;

  const persist = (nextRun: HigherLowerRun, nextStats: HigherLowerStats) => {
    saveHigherLowerRun(nextRun);
    saveHigherLowerStats(nextStats);
    setRun(nextRun);
    setStats(nextStats);
  };

  const startMode = (mode: MiniGamePoolMode) => {
    const nextPool = getHigherLowerPlayerPool(mode);
    const next = createHigherLowerRun(nextPool, undefined, mode);
    saveHigherLowerRun(next);
    setPoolMode(mode);
    setRun(next);
    setFlash(null);
    setCelebrate(false);
    setRewardOpen(false);
    setView("play");
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: stats?.bestStreak ?? 0,
      higherLowerFivePickWins: stats?.fivePickWins ?? 0,
    });
  };

  const pick = (choice: HigherLowerChoice) => {
    if (!run || !stats || run.revealed || run.status !== "playing") return;
    playMiniSelect();
    const result = answerHigherLower(run, choice, pool);
    playMiniReveal();
    let nextStats = applyHigherLowerPick(stats, result.correct);
    let nextRun = result.run;
    let awarded = false;

    if (result.correct && nextRun.status === "won") {
      const settled = settleWin(nextRun, nextStats);
      nextRun = settled.run;
      nextStats = settled.stats;
      awarded = settled.awarded;
      playMiniCorrect();
      playMiniWin();
      if (awarded) {
        playMiniMilestone();
        setRewardOpen(true);
      }
      setCelebrate(true);
    } else if (result.correct) {
      playMiniCorrect();
    } else {
      nextStats = applyHigherLowerRunEnd(nextStats, false);
      playMiniLose();
    }

    persist(nextRun, nextStats);
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
    setFlash(null);
  };

  const restart = () => {
    if (!poolMode) {
      clearHigherLowerRun();
      setRun(null);
      setView("select");
      return;
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    playMiniSelect();
    clearHigherLowerRun();
    const next = createHigherLowerRun(pool, undefined, poolMode);
    saveHigherLowerRun(next);
    setRun(next);
    setFlash(null);
    setCelebrate(false);
    setRewardOpen(false);
  };

  const pickNumber = run ? higherLowerPickNumber(run) : 1;
  const challengeRevealed = Boolean(run?.revealed);
  const runOver = run?.status === "won" || run?.status === "lost";

  if (!ready) {
    return (
      <MiniGameShell title="Higher or Lower" compact>
        <p className={`mt-4 text-center ${TYPO.meta}`}>Loading…</p>
      </MiniGameShell>
    );
  }

  if (view === "select") {
    return (
      <MiniGameShell
        eyebrow="Higher or Lower"
        title={<MiniGamePoolSelectTitle />}
        compact
      >
        <MiniGamePoolSelect onSelect={startMode} />
      </MiniGameShell>
    );
  }

  return (
    <MiniGameShell title="Higher or Lower" compact>
      {celebrate && <Confetti />}
      <MiniGameRewardPopup
        open={rewardOpen}
        amount={HIGHER_LOWER_FIVE_REWARD}
        detail="Reward for completing all 5 picks."
        onClose={() => setRewardOpen(false)}
      />
      <div className="mini-game-play hol-play mx-auto flex w-full max-w-sm flex-col items-center">
        <div className="text-center">
          <MiniGameStatLine
            items={[
              { label: "Wins", value: stats?.fivePickWins ?? 0 },
              { label: "Best", value: stats?.bestStreak ?? 0 },
            ]}
          />
        </div>

        {!run || !board ? (
          <p className={`mt-4 text-center ${TYPO.meta}`}>Loading players…</p>
        ) : (
          <>
            <div
              className="mini-game-pick-track hol-pick-track"
              aria-label={
                run.status === "won"
                  ? "5 picks complete"
                  : `Pick ${pickNumber} of ${HIGHER_LOWER_PICKS}`
              }
            >
              {Array.from({ length: HIGHER_LOWER_PICKS }, (_, index) => {
                const done = index < pickNumber - 1 || run.status === "won";
                const current =
                  run.status === "playing" && index === pickNumber - 1;
                return (
                  <span
                    key={index}
                    className={`mini-game-pick-dot ${
                      done
                        ? "mini-game-pick-dot--done"
                        : current
                          ? "mini-game-pick-dot--current"
                          : ""
                    }`}
                    aria-hidden
                  />
                );
              })}
            </div>

            {!run.revealed && run.status === "playing" ? (
              <p className={`mt-3 text-center ${TYPO.bodySm}`}>
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
              className={`mt-3 w-full rounded-xl transition ${
                flash === "good"
                  ? "border border-emerald-400/40 bg-emerald-500/5 p-1"
                  : flash === "bad"
                    ? "mini-game-shake border border-red-400/40 bg-red-500/5 p-1"
                    : "border border-transparent"
              }`}
            >
              <PlayerFace player={board.base} showRating />
              <div className="mini-game-vs-badge mini-game-vs-badge--tight" aria-hidden>
                VS
              </div>
              <PlayerFace
                player={board.challenge}
                showRating={challengeRevealed}
              />
            </div>

            {challengeRevealed && (
              <p className={`mt-2 text-center ${TYPO.bodySm}`}>
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
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <GameButton variant="theme" onClick={() => pick("higher")}>
                  Higher
                </GameButton>
                <GameButton variant="secondary" onClick={() => pick("lower")}>
                  Lower
                </GameButton>
              </div>
            )}

            {run.revealed && (
              <div className="mt-3 w-full text-center">
                <p className={TYPO.keyLabel}>
                  {run.status === "won"
                    ? "5 picks complete"
                    : run.lastCorrect
                      ? "Correct"
                      : "Wrong"}
                </p>
                <div className="mx-auto mt-2.5 w-full max-w-xs">
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
