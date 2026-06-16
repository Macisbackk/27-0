"use client";

import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { formatClubFunds } from "@/lib/club-funds";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface ClubFundsEarnedProps {
  payout: ClubFundsPayoutResult | null;
}

export function ClubFundsEarned({ payout }: ClubFundsEarnedProps) {
  if (!payout || payout.lines.length === 0) return null;

  return (
    <div
      className={`${CARD.panel} mx-auto mt-4 w-full max-w-md border border-accent-green/25 px-4 py-3 text-center`}
    >
      <p className={TYPO.sectionLabel}>Club Funds Earned</p>
      <ul className={`mt-2 space-y-1 ${TYPO.bodySm}`}>
        {payout.lines.map((line) => (
          <li key={line.id} className="text-gray-300">
            <span className="font-semibold text-accent-green">
              +{formatClubFunds(line.amount)}
            </span>{" "}
            {line.label}
          </li>
        ))}
      </ul>
      {payout.awarded && payout.total > 0 && (
        <p className={`mt-3 font-display text-sm font-bold text-white`}>
          Total +{formatClubFunds(payout.total)}
        </p>
      )}
      {!payout.awarded && payout.total > 0 && (
        <p className={`mt-2 ${TYPO.bodySm} text-gray-500`}>
          Already awarded for this run.
        </p>
      )}
    </div>
  );
}
