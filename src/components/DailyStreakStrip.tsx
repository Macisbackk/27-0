"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DAILY_STREAK_CHANGED_EVENT,
  getDailyChallengeHref,
  getDailyChallengeMeta,
  hasFinishedDailyChallengeToday,
  markDailyMilestoneCelebrated,
} from "@/lib/daily-challenge";
import {
  DAILY_FREEZE_EVERY,
  DAILY_MAX_FREEZES,
  nextStreakMilestone,
  pendingStreakMilestone,
  type DailyChallengeMeta,
} from "@/lib/daily-streak";
import { buyStreakFreeze, getStreakFreezeOffer } from "@/lib/streak-freeze";
import { CLUB_FUNDS_CHANGED_EVENT } from "@/lib/storage/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { GameButton } from "@/components/ui/GameButton";
import { TYPO } from "@/lib/ui/typography";

const MILESTONE_COPY: Record<number, string> = {
  3: "Three days running. The habit is forming.",
  7: "A full week. You've earned a streak freeze.",
  30: "A month of Dailies. Proper commitment.",
  100: "One hundred days. Hall of fame stuff.",
};

interface DailyStreakStripProps {
  className?: string;
  /** Compact: one line plus the buy button (used inside the Daily rule banner). */
  compact?: boolean;
}

/**
 * Daily streak status: streak, best, perfect days, held freezes (with a buy button), the next
 * milestone, and a one-time celebration at 3 / 7 / 30 / 100 days.
 */
export function DailyStreakStrip({ className = "", compact = false }: DailyStreakStripProps) {
  const [meta, setMeta] = useState<DailyChallengeMeta | null>(null);
  const [doneToday, setDoneToday] = useState(false);
  const [offer, setOffer] = useState<ReturnType<typeof getStreakFreezeOffer> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);

  const refresh = useCallback(() => {
    const next = getDailyChallengeMeta();
    setMeta(next);
    setDoneToday(hasFinishedDailyChallengeToday());
    setOffer(getStreakFreezeOffer());
    const milestone = pendingStreakMilestone(next);
    if (milestone) setCelebrating(milestone);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(DAILY_STREAK_CHANGED_EVENT, refresh);
    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(DAILY_STREAK_CHANGED_EVENT, refresh);
      window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  if (!meta || !offer) return null;

  const streak = meta.currentStreak;
  const freezes = meta.freezes ?? 0;
  const next = nextStreakMilestone(streak);
  const toNextFreeze = DAILY_FREEZE_EVERY - (streak % DAILY_FREEZE_EVERY);

  const onBuy = () => {
    const result = buyStreakFreeze();
    if (result.ok) {
      setMessage(`Freeze bought. You hold ${result.freezes} of ${DAILY_MAX_FREEZES}.`);
    } else {
      setMessage(
        result.reason === "max-held"
          ? `You already hold the most freezes (${DAILY_MAX_FREEZES}).`
          : `Not enough Club Funds (${formatClubFunds(offer.price)} needed).`
      );
    }
    refresh();
  };

  const dismissCelebration = () => {
    if (celebrating) markDailyMilestoneCelebrated(celebrating);
    setCelebrating(null);
  };

  const buyButton = (
    <GameButton
      variant="secondary"
      size="sm"
      fullWidth={false}
      onClick={onBuy}
      disabled={!offer.canBuy}
    >
      {offer.reason === "max-held" ? "Freezes full" : `Buy freeze · ${formatClubFunds(offer.price)}`}
    </GameButton>
  );

  return (
    <section
      className={`rounded-tile border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 ${className}`}
      aria-label="Daily streak"
    >
      {celebrating ? (
        <div className="mb-2 rounded-tile bg-accent-gold/15 px-3 py-2 text-center" role="status">
          <p className="font-display text-lg font-bold text-accent-gold">{celebrating}-day streak!</p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-gray-100`}>{MILESTONE_COPY[celebrating]}</p>
          <button
            type="button"
            onClick={dismissCelebration}
            className="mt-1 text-xs font-semibold text-accent-gold underline-offset-2 hover:underline"
          >
            Nice one
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1">
            <dt className="text-gray-400">Streak</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-amber-300">{streak}</dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt className="text-gray-400">Best</dt>
            <dd className="font-semibold tabular-nums text-white">{meta.bestStreak}</dd>
          </div>
          <div className="flex items-baseline gap-1" title="Top of the table and Grand Final on the same day">
            <dt className="text-gray-400">Perfect days</dt>
            <dd className="font-semibold tabular-nums text-white">{meta.perfectDays ?? 0}</dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt className="text-gray-400">Freezes</dt>
            <dd className="font-semibold tabular-nums text-sky-300" aria-label={`${freezes} of ${DAILY_MAX_FREEZES} streak freezes held`}>
              {freezes}/{DAILY_MAX_FREEZES}
            </dd>
          </div>
        </dl>
        {buyButton}
      </div>

      {!compact ? (
        <p className={`mt-1.5 ${TYPO.meta}`}>
          {doneToday
            ? "Today's Daily is done: your streak is safe."
            : streak > 0
              ? "Finish today's Daily (win or lose) to keep your streak."
              : "Finish today's Daily to start a streak."}{" "}
          {next ? `${next - streak} to the ${next}-day milestone. ` : ""}
          {freezes < DAILY_MAX_FREEZES ? `Next free freeze in ${toNextFreeze} day${toNextFreeze === 1 ? "" : "s"}. ` : ""}
          A missed day uses a freeze automatically.
        </p>
      ) : null}
      {!compact && !doneToday ? (
        <div className="mt-2">
          <GameButton variant="theme" size="sm" fullWidth={false} href={getDailyChallengeHref()}>
            Play today&apos;s Daily
          </GameButton>
        </div>
      ) : null}
      {message ? (
        <p className={`mt-1.5 ${TYPO.meta}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
