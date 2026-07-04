"use client";

import { useMemo, useState } from "react";
import { ClubFundsEarned } from "@/components/ClubFundsEarned";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSeasonSummary } from "@/lib/manager/managerState";
import { resolveInboxMessage } from "@/lib/manager/managerInbox";
import {
  claimManagerSeasonRewards,
  computeManagerSeasonRewardLines,
  formatRewardTotal,
  getManagerSeasonRewardSplit,
  isManagerSeasonRewardClaimed,
} from "@/lib/manager/managerSeasonRewards";
import { formatWage } from "@/lib/manager/managerContracts";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { playSeasonComplete, playUiClick } from "@/lib/sound";

interface ManagerSeasonRewardsProps {
  career: ManagerCareer;
  onClaimed: (career: ManagerCareer) => void;
  onContinue: () => void;
  onHome: () => void;
}

export function ManagerSeasonRewards({
  career,
  onClaimed,
  onContinue,
  onHome,
}: ManagerSeasonRewardsProps) {
  const summary = buildSeasonSummary(career);
  const lines = useMemo(
    () => computeManagerSeasonRewardLines(career, summary),
    [career, summary]
  );
  const alreadyClaimed = isManagerSeasonRewardClaimed(career);
  const [payout, setPayout] = useState<ClubFundsPayoutResult | null>(
    alreadyClaimed
      ? {
          runId: `manager-${career.id}-s${career.seasonYear}`,
          lines,
          total: lines.reduce((s, l) => s + l.amount, 0),
          awarded: false,
          newBalance: 0,
        }
      : null
  );
  const [claimed, setClaimed] = useState(alreadyClaimed);

  const handleClaim = () => {
    playUiClick();
    const result = claimManagerSeasonRewards(career, summary);
    const msgId = `season-reward-s${career.seasonYear}`;
    const nextCareer = resolveInboxMessage(result.career, msgId);
    setPayout(result.payout);
    setClaimed(true);
    onClaimed(nextCareer);
    playSeasonComplete();
  };

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onHome}>
        Return Home
      </GameButton>

      <div className={`${CARD.elevated} ${SPACING.cardPaddingLg} text-center`}>
        <p className={TYPO.sectionLabel}>End of Season Rewards</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 text-2xl font-bold text-accent-gold`}>
          {formatRewardTotal(lines)}
        </p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Added to your transfer fund and club operations when claimed
        </p>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Reward Breakdown</p>
        <ul className={SPACING.stackSm}>
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-pitch-300">{line.label}</span>
              <span className="text-accent-gold">
                +£{(line.amount / 1000).toFixed(0)}k
              </span>
            </li>
          ))}
        </ul>
      </div>

      {payout && payout.awarded && (
        <>
          <ClubFundsEarned payout={payout} title="Season earnings" />
          {(() => {
            const { transfer, operating } = getManagerSeasonRewardSplit(
              payout.total
            );
            return (
              <p className={`${TYPO.bodySm} text-center text-pitch-300`}>
                <span className="text-accent-gold">{formatWage(transfer)}</span>
                <span className="text-pitch-500"> to transfer fund · </span>
                <span className="text-theme-primary">
                  {formatWage(operating)}
                </span>
                <span className="text-pitch-500"> to club operations</span>
              </p>
            );
          })()}
        </>
      )}

      {claimed && !payout?.awarded && (
        <p className={`${TYPO.bodySm} text-theme-primary text-center`}>
          Rewards already claimed for this season.
        </p>
      )}

      {!claimed && (
        <GameButton variant="theme" onClick={handleClaim}>
          Claim season earnings
        </GameButton>
      )}

      {claimed && (
        <GameButton variant="theme" onClick={() => {
          playUiClick();
          onContinue();
        }}>
          Continue to Next Season
        </GameButton>
      )}

      <GameButton variant="secondary" onClick={onHome}>
        Return Home
      </GameButton>
    </div>
  );
}
