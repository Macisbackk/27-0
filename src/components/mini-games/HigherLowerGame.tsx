"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { playUiClick } from "@/lib/sound";
import { createRunId } from "@/lib/quiz/rng";
import { getLocalDateKey } from "@/lib/mini-games/date";
import {
  formatMiniGamePlayerLabel,
  getHigherLowerPlayerPool,
} from "@/lib/mini-games/players";
import {
  advanceHigherLower,
  answerHigherLower,
  applyHigherLowerResult,
  createHigherLowerRun,
  resolveHigherLowerPair,
} from "@/lib/mini-games/higher-lower/engine";
import {
  loadHigherLowerRun,
  loadHigherLowerStats,
  saveHigherLowerRun,
  saveHigherLowerStats,
} from "@/lib/mini-games/higher-lower/storage";
import type { HigherLowerRun, HigherLowerStats } from "@/lib/mini-games/higher-lower/types";
import {
  claimMiniGameReward,
  HIGHER_LOWER_FIVE_REWARD,
  HIGHER_LOWER_TEN_REWARD,
} from "@/lib/mini-games/rewards";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import type { MiniGamePlayer } from "@/lib/mini-games/players";

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
    }
  }
  return { stats: next, note };
}

function PlayerCard({
  player,
  revealed,
  selected,
  onPick,
  disabled,
}: {
  player: MiniGamePlayer;
  revealed: boolean;
  selected: boolean;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`min-h-[8.5rem] w-full border px-4 py-4 text-left ${
        selected
          ? "border-theme-primary bg-theme-primary/10"
          : "border-white/10 bg-[#0c1210]"
      }`}
    >
      <p className={TYPO.playerNameSm}>{formatMiniGamePlayerLabel(player)}</p>
      <p className={`mt-1 ${TYPO.bodySm}`}>
        {player.club} · {player.positionLabel}
      </p>
      <p className={`mt-3 ${TYPO.statValueLg}`}>
        {revealed ? player.rating : "?"}
      </p>
    </button>
  );
}

export function HigherLowerGame() {
  const pool = useMemo(() => getHigherLowerPlayerPool(), []);
  const [run, setRun] = useState<HigherLowerRun | null>(null);
  const [stats, setStats] = useState<HigherLowerStats | null>(null);
  const [note, setNote] = useState<PayoutNote>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedRun = loadHigherLowerRun();
    const storedStats = loadHigherLowerStats();
    const nextRun = storedRun ?? createHigherLowerRun(createRunId(), pool);
    saveHigherLowerRun(nextRun);
    setRun(nextRun);
    setStats(storedStats);
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: storedStats.bestStreak,
    });
    setReady(true);
  }, [pool]);

  const pair = run ? resolveHigherLowerPair(run, pool) : null;

  const pick = (side: "left" | "right") => {
    if (!run || !stats || run.revealed) return;
    playUiClick();
    const result = answerHigherLower(run, side, pool);
    const nextStats = applyHigherLowerResult(stats, result.correct);
    const rewarded = result.correct
      ? maybeRewardStreak(nextStats, getLocalDateKey())
      : { stats: nextStats, note: null };
    saveHigherLowerRun(result.run);
    saveHigherLowerStats(rewarded.stats);
    setRun(result.run);
    setStats(rewarded.stats);
    setNote(rewarded.note);
    triggerMiniGameAchievements({
      played: true,
      higherLowerBestStreak: rewarded.stats.bestStreak,
    });
  };

  const nextRound = () => {
    if (!run) return;
    playUiClick();
    const next = advanceHigherLower(run, pool);
    saveHigherLowerRun(next);
    setRun(next);
    setNote(null);
  };

  return (
    <MiniGameShell title="Higher or Lower">
      <p className={`mt-2 ${TYPO.pageSubtitle}`}>
        Which player has the higher rating? Early rounds are wide apart; later
        rounds get tight.
      </p>
      <MiniGameStatLine
        items={[
          { label: "Streak", value: stats?.currentStreak ?? 0 },
          { label: "Best", value: stats?.bestStreak ?? 0 },
        ]}
      />

      {!ready || !run || !pair ? (
        <p className={`mt-6 ${TYPO.meta}`}>Loading players…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <PlayerCard
              player={pair.left}
              revealed={run.revealed}
              selected={run.lastChoice === "left"}
              disabled={run.revealed}
              onPick={() => pick("left")}
            />
            <PlayerCard
              player={pair.right}
              revealed={run.revealed}
              selected={run.lastChoice === "right"}
              disabled={run.revealed}
              onPick={() => pick("right")}
            />
          </div>

          {run.revealed && (
            <div className="mt-6 text-center">
              <p className={TYPO.cardTitle}>
                {run.lastCorrect ? "Correct" : "Wrong"}
              </p>
              {note && <p className={`mt-2 ${TYPO.bodySm}`}>{note}</p>}
              <div className="mx-auto mt-4 max-w-xs">
                <GameButton variant="theme" onClick={nextRound}>
                  {run.lastCorrect ? "Next pair" : "Try again"}
                </GameButton>
              </div>
            </div>
          )}
        </>
      )}
    </MiniGameShell>
  );
}
