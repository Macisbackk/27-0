"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { CountUp } from "@/components/ui/CountUp";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";
import { useSheetSlot } from "@/lib/ui/popup-queue";

interface ClubFundsEarnedProps {
  payout: ClubFundsPayoutResult | null | undefined;
  title?: string;
  /** Wait this long before the sheet rises, so the result itself is seen first. */
  delayMs?: number;
}

/**
 * Club Funds breakdown popup for season / playoff review and the login welcome.
 * Goes through the global sheet queue: if another reward sheet is already up, this one waits
 * for it to close instead of stacking on top.
 */
export function ClubFundsEarned({
  payout,
  title = "Club Funds Earned",
  delayMs = 0,
}: ClubFundsEarnedProps) {
  const hasLines = Boolean(payout?.lines.length);
  const [open, setOpen] = useState(hasLines && delayMs <= 0);

  // Funds are often awarded in a parent effect after review mounts. On the run reviews the
  // sheet waits a beat (delayMs) so the grade / finish lands before the reward covers it.
  useEffect(() => {
    if (!hasLines) return;
    if (delayMs <= 0) {
      setOpen(true);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(t);
  }, [hasLines, payout?.runId, payout?.total, delayMs]);

  const granted = useSheetSlot(Boolean(payout && hasLines && open));

  if (!payout || !hasLines) return null;

  return (
    <GameModal
      open={granted}
      onClose={() => setOpen(false)}
      labelledBy="club-funds-earned-title"
      className="fl-modal"
    >
      <div className="space-y-4 text-center">
        <p id="club-funds-earned-title" className={TYPO.cardHeading}>
          {title}
        </p>
        <ul className="fl-stagger space-y-1.5 text-left">
          {payout.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-baseline justify-between gap-3 rounded-control bg-pitch-800 px-3 py-2.5 text-sm text-[color:var(--fl-text)]"
            >
              <span className="min-w-0">{line.label}</span>
              {/* Non-cash lines (an item unlocked with the payout) carry amount 0. */}
              <span className="shrink-0 font-bold tabular-nums text-theme-primary">
                {line.amount > 0 ? `+${formatClubFunds(line.amount)}` : "Unlocked"}
              </span>
            </li>
          ))}
        </ul>
        {payout.awarded && payout.total > 0 && (
          <div>
            <p className={TYPO.label}>Total</p>
            <p className="fl-number mt-1 text-[34px] text-theme-primary">
              +<CountUp value={payout.total} from={0} format={formatClubFunds} durationMs={900} />
            </p>
          </div>
        )}
        {!payout.awarded && payout.total > 0 && (
          <p className={TYPO.label}>Already awarded for this run.</p>
        )}
        <div className="mx-auto max-w-xs">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              setOpen(false);
            }}
          >
            Continue
          </GameButton>
        </div>
      </div>
    </GameModal>
  );
}
