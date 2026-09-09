"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { getLocalDateKey } from "@/lib/mini-games/date";
import {
  formatMiniGamePlayerLabel,
  getHigherLowerPlayerPool,
  type MiniGamePlayer,
} from "@/lib/mini-games/players";
import {
  advanceHigherLower,
  answerHigherLower,
  applyHigherLowerResult,
  createHigherLowerRun,
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
  HIGHER_LOWER_TEN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { Confetti } from "@/components/Confetti";
import {
  playMiniCorrect,
  playMiniMilestone,
  playMiniSelect,
  playMiniLose,
} from "@/lib/mini-games/sound";

type PayoutNote = string | null;

function maybeRewardStreak(
  stats: HigherLowerStats,
  date: string
): { stats: HigherLowerStats; note: PayoutNote } {
  let next = stats;
  let note: PayoutNote = null;
  if (stats.currentStreak >= 5 && stats.lastFiveRewardDate !== date) {
    const payout = claimMiniGameReward(
      `hol_5:${date}`,
      "Higher or Lower — 5 streak",
      HIGHER_LOWER_FIVE_REWARD
    );
    if (payout.awarded) {
      next = { ...next, lastFiveRewardDate: date };
      note = `+${formatClubFundsExact(HIGHER_LOWER_FIVE_REWARD)} for a 5 streak`;
      playMiniMilestone();
    }
  }
  if (stats.currentStreak >= 10 && stats.lastTenRewardDate !== date) {
    const payout = claimMiniGameReward(
      `hol_10:${date}`,
      "Higher or Lower — 10 streak",
      HIGHER_LOWER_TEN_REWARD
    );
    if (payout.awarded) {
      next = { ...next, lastTenRewardDate: date };
      note = `+${formatClubFundsExact(HIGHER_LOWER_TEN_REWARD)} for a 10 streak`;
      playMiniMilestone();
    }
  }
  return { stats: next, note };
}

function HistoryCard({
  player,
  showRating,
  isBase,
}: {
  player: MiniGamePlayer;
  showRating: boolean;
  isBase?: boolean;
}) {
  return (
    <div
      className={`min-w-0 flex-1 border px-2 py-2 text-center ${
        isBase
          ? "border-theme-primary/50 bg-theme-primary/10"
          : "border-white/10 bg-[#0c1210]"
      }`}
    >
      <p className="truncate text-xs font-semibold text-white sm:text-sm">
        {formatMiniGamePlayerLabel(player)}
      </p>
      <p className={`mt-1 text-sm tabular-nums ${showRating ? "text-white" : "text-gray-600"}`}>
        {showRating ? player.rating : "—"}
      </p>
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

  useEffect(() => {
    const storedStats = loadHigherLowerStats();
    const storedRun = loadHigherLowerRun();
    const nextRun =
      storedRun &&
      storedRun.status === "playing" &&
      Array.isArray(storedRun.historyIds) &&
      storedRun.historyIds.length > 0
        ? storedRun
        : createHigherLowerRun(pool);
    saveHigherLowerRun(nextRun);
    setRun(nextRun);
    setStats(storedStats);
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: storedStats.bestStreak,
    });
    setReady(true);
  }, [pool]);

  const board = run ? resolveHigherLowerPlayers(run, pool) : null;

  const pick = (choice: HigherLowerChoice) => {
    if (!run || !stats || run.revealed || run.status !== "playing") return;
    playMiniSelect();
    const result = answerHigherLower(run, choice, pool);
    const nextStats = applyHigherLowerResult(stats, result.correct);
    const rewarded = result.correct
      ? maybeRewardStreak(nextStats, getLocalDateKey())
      : { stats: nextStats, note: null as PayoutNote };
    saveHigherLowerRun(result.run);
    saveHigherLowerStats(rewarded.stats);
    setRun(result.run);
    setStats(rewarded.stats);
    setNote(rewarded.note);
    setFlash(result.correct ? "good" : "bad");
    if (result.correct) {
      playMiniCorrect();
      if (rewarded.stats.currentStreak > 0 && rewarded.stats.currentStreak % 5 === 0) {
        setCelebrate(true);
      }
    } else playMiniLose();
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: rewarded.stats.bestStreak,
    });
  };

  const continueRun = () => {
    if (!run || !stats || !run.lastCorrect) return;
    playMiniSelect();
    const next = advanceHigherLower(run, stats.currentStreak, pool);
    saveHigherLowerRun(next);
    setRun(next);
    setNote(null);
    setFlash(null);
    setCelebrate(false);
  };

  const restart = () => {
    playMiniSelect();
    clearHigherLowerRun();
    const next = createHigherLowerRun(pool);
    saveHigherLowerRun(next);
    setRun(next);
    setNote(null);
    setFlash(null);
    setCelebrate(false);
  };

  const revealedIds = new Set<string>();
  if (run?.revealed) {
    revealedIds.add(run.baseId);
    revealedIds.add(run.challengeId);
  }
  // Once a player has been the base after a correct round, their rating stays known in history.
  if (board && stats) {
    for (const player of board.history) {
      if (player.id === run?.baseId) revealedIds.add(player.id);
    }
  }

  return (
    <MiniGameShell title="Higher or Lower">
      {celebrate && <Confetti />}
      <div className="mx-auto w-full max-w-lg">
        <p className={`mt-2 text-center ${TYPO.pageSubtitle}`}>
          Five players lead the run. A new challenge appears — is their rating
          higher or lower than the current player?
        </p>
        <div className="text-center">
          <MiniGameStatLine
            items={[
              { label: "Streak", value: stats?.currentStreak ?? 0 },
              { label: "Best", value: stats?.bestStreak ?? 0 },
            ]}
          />
        </div>

        {!ready || !run || !board ? (
          <p className={`mt-6 text-center ${TYPO.meta}`}>Loading players…</p>
        ) : (
          <>
            <div className="mt-5 flex gap-1.5 sm:gap-2">
              {board.history.map((player) => (
                <HistoryCard
                  key={player.id}
                  player={player}
                  showRating={
                    revealedIds.has(player.id) || player.id === run.baseId
                  }
                  isBase={player.id === run.baseId}
                />
              ))}
            </div>

            <p className={`mt-6 text-center ${TYPO.keyLabel}`}>Challenge</p>
            <div
              className={`mx-auto mt-2 max-w-sm border px-4 py-5 text-center transition ${
                flash === "good"
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : flash === "bad"
                    ? "mini-game-shake border-red-400/50 bg-red-500/10"
                    : "border-white/10 bg-[#0c1210]"
              }`}
            >
              <p className={TYPO.playerNameSm}>
                {formatMiniGamePlayerLabel(board.challenge)}
              </p>
              <p className={`mt-1 ${TYPO.bodySm}`}>
                {board.challenge.club} · {board.challenge.positionLabel}
              </p>
              <p className={`mt-4 ${TYPO.statValueLg}`}>
                {run.revealed ? board.challenge.rating : "?"}
              </p>
              {run.revealed && (
                <p className={`mt-2 ${TYPO.bodySm}`}>
                  vs {formatMiniGamePlayerLabel(board.base)}{" "}
                  ({board.base.rating}) —{" "}
                  {board.challenge.rating > board.base.rating
                    ? "↑ Higher"
                    : "↓ Lower"}
                </p>
              )}
            </div>

            {!run.revealed && run.status === "playing" && (
              <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
                <GameButton variant="theme" onClick={() => pick("higher")}>
                  Higher
                </GameButton>
                <GameButton variant="secondary" onClick={() => pick("lower")}>
                  Lower
                </GameButton>
              </div>
            )}

            {run.revealed && (
              <div className="mt-6 text-center">
                <p className={TYPO.cardTitle}>
                  {run.lastCorrect ? "Correct" : "Wrong"}
                </p>
                {note && <p className={`mt-2 ${TYPO.bodySm}`}>{note}</p>}
                <div className="mx-auto mt-4 max-w-xs">
                  {run.lastCorrect ? (
                    <GameButton variant="theme" onClick={continueRun}>
                      Next challenge
                    </GameButton>
                  ) : (
                    <GameButton variant="theme" onClick={restart}>
                      Play again
                    </GameButton>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MiniGameShell>
  );
}
