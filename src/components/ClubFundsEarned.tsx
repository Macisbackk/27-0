"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { CountUp } from "@/components/ui/CountUp";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

interface ClubFundsEarnedProps {
  payout: ClubFundsPayoutResult | null | undefined;
  title?: string;
}

/** Club Funds breakdown popup for season / playoff review. */
export function ClubFundsEarned({
  payout,
  title = "Club Funds Earned",
}: ClubFundsEarnedProps) {
  const hasLines = Boolean(payout?.lines.length);
  const [open, setOpen] = useState(hasLines);

  // Funds are often awarded in a parent effect after review mounts.
  useEffect(() => {
    if (hasLines) setOpen(true);
  }, [hasLines, payout?.runId, payout?.total]);

  if (!payout || !hasLines) return null;

  return (
    <GameModal
      open={open}
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
              className="flex items-baseline justify-between gap-3 rounded-[14px] bg-pitch-800 px-3 py-2.5 text-sm text-[color:var(--fl-text)]"
            >
              <span className="min-w-0">{line.label}</span>
              <span className="shrink-0 font-bold tabular-nums text-theme-primary">
                +{formatClubFunds(line.amount)}
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
