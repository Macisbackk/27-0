"use client";

import { useEffect, useMemo } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerTransferPlayerCard } from "@/components/manager/ManagerTransferPlayerCard";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { formatWage } from "@/lib/manager/managerContracts";
import type { InboxMessage, ManagerCareer } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { getFullPositionName } from "@/lib/positions";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { playTransferOffer, playUiClick } from "@/lib/sound";

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
  const senior = offer.playerId ? getPlayerById(offer.playerId) : null;
  const reserve = offer.playerId
    ? career.reserves.find((r) => r.id === offer.playerId)
    : undefined;
  const contract = offer.playerId
    ? career.contracts[offer.playerId] ??
      career.reserveContracts?.[offer.playerId]
    : undefined;
  const buyer = offer.offerClub ?? "A rival club";
  const fee = offer.offerAmount ?? 0;
  const loanOffer = Boolean(offer.loanOffer);
  const parentWageShare =
    typeof offer.loanParentWageShare === "number"
      ? offer.loanParentWageShare
      : 0.5;
  const listed =
    !offer.unsolicited &&
    !offer.reserveOffer &&
    Boolean(
      offer.playerId &&
        (career.playerTransferStatus[offer.playerId]?.listed ||
          career.leagueListedPlayers.some((row) => row.playerId === offer.playerId))
    );

  const display = useMemo(() => {
    if (senior) {
      return {
        name: senior.name,
        peakRating: senior.peakRating,
        wagePerYear: contract?.wagePerYear ?? 0,
        positionLabel: null as string | null,
      };
    }
    if (reserve) {
      return {
        name: reserve.name,
        peakRating: reserve.rating,
        wagePerYear: contract?.wagePerYear ?? 0,
        positionLabel: getFullPositionName(reserve.position),
      };
    }
    return null;
  }, [senior, reserve, contract]);

  // Escape must not reject — advance week stays blocked until Accept/Reject.
  const panelRef = useModalA11y(true, () => {});

  useEffect(() => {
    playTransferOffer();
  }, []);

  if (!display || !offer.playerId) return null;

  const pill = offer.reserveOffer
    ? "Reserve squad offer"
    : loanOffer
      ? listed
        ? "Loan approach · Listed"
        : "Loan approach"
      : listed
        ? "Senior squad offer · Listed"
        : "Senior squad offer";
  const headline = offer.reserveOffer
    ? "Reserve Transfer Offer"
    : loanOffer
      ? "Loan Offer"
      : listed
        ? "Senior Transfer Offer"
        : "Senior Transfer Approach";
  const intro = offer.reserveOffer
    ? `${buyer} have bid ${formatWage(fee)} for reserve ${display.name}.`
    : loanOffer
      ? `${buyer} want ${display.name} on loan until the end of the season. You keep paying ${Math.round(parentWageShare * 100)}% of wages.`
      : listed
        ? `${buyer} have offered ${formatWage(fee)} for senior player ${display.name}.`
        : `${buyer} want to sign senior player ${display.name} without them being listed for transfer.`;

  return (
    <div
      className={`fixed inset-0 z-[94] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} overflow-y-auto sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-bid-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`game-modal-panel w-full max-w-lg max-h-[min(78dvh,720px)] overflow-y-auto overflow-x-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("amber")}>
          <span className={managerPillClass("amber")}>{pill}</span>
          <h2 id="incoming-bid-title" className={`mt-3 ${TYPO.cardTitle}`}>
            {headline}
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>{intro}</p>
        </div>

        {senior ? (
          <ManagerTransferPlayerCard
            player={senior}
            club={career.club}
            listed={listed}
            listingType={loanOffer ? "loan" : listed ? "permanent" : undefined}
            fee={fee}
            wagePerYear={display.wagePerYear}
          >
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              {loanOffer ? (
                <>
                  Season loan · no permanent fee. Accepting sends {display.name}{" "}
                  to {buyer} until season end.
                </>
              ) : listed && offer.askingPrice != null ? (
                <>
                  Asking price{" "}
                  <span className="font-semibold text-pitch-200">
                    {formatWage(offer.askingPrice)}
                  </span>
                  . Accepting adds the fee to your transfer budget.
                </>
              ) : (
                <>
                  Valuation around{" "}
                  <span className="font-semibold text-pitch-200">
                    {formatWage(offer.askingPrice ?? fee)}
                  </span>
                  . Accepting adds the fee to your transfer budget.
                </>
              )}
            </p>
          </ManagerTransferPlayerCard>
        ) : (
          <div className="mt-3 rounded-lg border border-pitch-700/50 bg-pitch-950/40 p-3">
            <p className="font-semibold text-white">{display.name}</p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              {display.positionLabel ?? "Reserve"} · Rating {display.peakRating}
              {reserve?.potentialRating != null
                ? ` · POT ${reserve.potentialRating}`
                : ""}
              {display.wagePerYear > 0
                ? ` · ${formatWage(display.wagePerYear)}/yr`
                : ""}
            </p>
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
              Offer{" "}
              <span className="font-semibold text-accent-gold">
                {formatWage(fee)}
              </span>
              . Accepting completes the move to {buyer}.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onAccept();
            }}
          >
            {loanOffer
              ? "Accept loan"
              : `Accept ${formatWage(fee)}`}
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
