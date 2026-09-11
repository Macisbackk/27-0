"use client";

import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

interface ClubFundsEarnedProps {
  payout: ClubFundsPayoutResult | null;
  open: boolean;
  onClose: () => void;
  title?: string;
}

/** Club Funds breakdown popup for season / playoff review. */
export function ClubFundsEarned({
  payout,
  open,
  onClose,
  title = "Club Funds Earned",
}: ClubFundsEarnedProps) {
  if (!payout || payout.lines.length === 0) return null;

  return (
    <GameModal open={open} onClose={onClose} labelledBy="club-funds-earned-title">
      <div className="space-y-4 text-center">
        <p id="club-funds-earned-title" className={TYPO.sectionLabel}>
          {title}
        </p>
        <ul className={`space-y-1.5 ${TYPO.bodySm}`}>
          {payout.lines.map((line) => (
            <li key={line.id} className="text-gray-300">
              <span className="font-semibold text-theme-primary">
                +{formatClubFunds(line.amount)}
              </span>{" "}
              {line.label}
            </li>
          ))}
        </ul>
        {payout.awarded && payout.total > 0 && (
          <p className="font-display text-lg font-bold text-white">
            Total +{formatClubFunds(payout.total)}
          </p>
        )}
        {!payout.awarded && payout.total > 0 && (
          <p className={`${TYPO.bodySm} text-gray-500`}>
            Already awarded for this run.
          </p>
        )}
        <div className="mx-auto max-w-xs">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onClose();
            }}
          >
            Continue
          </GameButton>
        </div>
      </div>
    </GameModal>
  );
}
