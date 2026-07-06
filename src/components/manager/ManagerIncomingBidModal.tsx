"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerTransferPlayerCard } from "@/components/manager/ManagerTransferPlayerCard";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { formatWage } from "@/lib/manager/managerContracts";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { managerModalHeaderClass, managerPillClass } from "@/lib/manager/managerSurfaces";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerIncomingBidModalProps {
  career: ManagerCareer;
  offer: InboxMessage;
  onAccept: () => void;
  onReject: () => void;
}

export function ManagerIncomingBidModal({
  career,
  offer,
  onAccept,
  onReject,
}: ManagerIncomingBidModalProps) {
  const player = offer.playerId ? getPlayerById(offer.playerId) : null;
  const contract = offer.playerId ? career.contracts[offer.playerId] : undefined;
  const buyer = offer.offerClub ?? "A rival club";
  const fee = offer.offerAmount ?? 0;

  const handleDismiss = useCallback(() => {
    playUiClick();
    onReject();
  }, [onReject]);

  const panelRef = useModalA11y(true, handleDismiss);

  useEffect(() => {
    playMenuOpen();
  }, []);

  if (!player || !offer.playerId) return null;

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-bid-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-lg overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("amber")}>
          <span className={managerPillClass("amber")}>
            Unlisted player
          </span>
          <h2 id="incoming-bid-title" className={`mt-3 ${TYPO.cardTitle}`}>
            Transfer Approach
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {buyer} want to sign {player.name} without them being listed for
            transfer.
          </p>
        </div>

        <ManagerTransferPlayerCard
          player={player}
          club={career.club}
          listed={false}
          fee={fee}
          wagePerYear={contract?.wagePerYear ?? 0}
        >
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Valuation around{" "}
            <span className="font-semibold text-pitch-200">
              {formatWage(offer.askingPrice ?? fee)}
            </span>
            . Accepting adds the fee to your transfer budget.
          </p>
        </ManagerTransferPlayerCard>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onAccept();
            }}
          >
            Accept {formatWage(fee)}
          </GameButton>
          <GameButton
            variant="secondary"
            onClick={() => {
              playUiClick();
              onReject();
            }}
          >
            Reject offer
          </GameButton>
        </div>
      </div>
    </div>
  );
}
