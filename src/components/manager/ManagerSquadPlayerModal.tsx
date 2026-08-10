"use client";

import { useCallback, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import { formatWage } from "@/lib/manager/managerContracts";
import {
  computeReleaseCost,
  listPlayerForLoanWithOffers,
  listPlayerForTransferWithOffers,
  releasePlayerWithCost,
  suggestedAskingPrice,
  unlistPlayerFromTransfer,
} from "@/lib/manager/managerTransferLeague";
import {
  completeOutgoingLoan,
  canUserLoanOutPlayers,
  evaluateLoanWageShareOffer,
  getLoanOutDestinationClubs,
  isPlayerLoanedIn,
  normalizeLoanWageSharePct,
  suggestedLoanFee,
} from "@/lib/manager/managerLoans";
import { findPlayerMatchdaySlot } from "@/lib/manager/managerMatchdaySquad";
import { validateFitMatchdaySquad } from "@/lib/manager/managerMatchdayValidation";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { ManagerDialog } from "@/components/manager/ManagerDialog";

interface ManagerSquadPlayerModalProps {
  career: ManagerCareer;
  playerId: string;
  onClose: () => void;
  onUpdate: (career: ManagerCareer) => void;
  onReplace: (playerId: string) => void;
}

export function ManagerSquadPlayerModal({
  career,
  playerId,
  onClose,
  onUpdate,
  onReplace,
}: ManagerSquadPlayerModalProps) {
  const [askingPrice, setAskingPrice] = useState(
    suggestedAskingPrice(playerId)
  );
  const [showListForm, setShowListForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanClub, setLoanClub] = useState(
    () => getLoanOutDestinationClubs(career)[0] ?? ""
  );
  const [loanParentSharePct, setLoanParentSharePct] = useState(50);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

  const player = getManagerPlayer(career, playerId);
  const contract = career.contracts[playerId];
  const transferStatus = career.playerTransferStatus[playerId];
  const slot = findPlayerMatchdaySlot(career, playerId);
  const releaseCost = computeReleaseCost(career, playerId);
  const loanedIn = isPlayerLoanedIn(career, playerId);
  const canLoanOut = canUserLoanOutPlayers(career);
  const loanDestinations = canLoanOut
    ? getLoanOutDestinationClubs(career)
    : [];
  const loanFee = suggestedLoanFee(career, playerId, career.club);

  if (!player) return null;

  const handleList = () => {
    onUpdate(listPlayerForTransferWithOffers(career, playerId, askingPrice));
    setShowListForm(false);
  };

  const handleUnlist = () => {
    onUpdate(unlistPlayerFromTransfer(career, playerId));
  };

  const handleLoanOut = () => {
    if (!loanClub) return;
    const sharePct = normalizeLoanWageSharePct(loanParentSharePct);
    const shareEval = evaluateLoanWageShareOffer(
      career,
      playerId,
      sharePct / 100
    );
    if (!shareEval.accepted) {
      setErrorDialog(shareEval.reason);
      return;
    }
    onUpdate(
      completeOutgoingLoan(career, playerId, loanClub, {
        loanFee,
        parentWageShare: shareEval.userWageShare,
        canRecall: true,
      })
    );
    onClose();
  };

  const handleRelease = () => {
    setReleaseConfirmOpen(true);
  };

  const confirmRelease = () => {
    setReleaseConfirmOpen(false);
    const result = releasePlayerWithCost(career, playerId);
    if (!result.ok) {
      setErrorDialog(result.error ?? "Could not release this player.");
      return;
    }
    if (result.career) onUpdate(result.career);
    onClose();
  };

  const releaseConfirmMessage = (() => {
    const fitCheck = validateFitMatchdaySquad(career);
    const fitWarning = fitCheck.valid
      ? ""
      : "\n\nWarning: releasing this player may leave you without a fit matchday 17. Play and simulate will stay disabled until fixed.";
    return `Release ${player.name}? Settlement cost: ${formatWage(releaseCost)}${fitWarning}`;
  })();

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} ${SPACING.safeBottom} overflow-y-auto sm:items-center`}
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`game-modal-panel w-full max-w-md max-h-[min(78dvh,720px)] overflow-y-auto overflow-x-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={TYPO.cardTitle}>{player.name}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <span>{POSITION_SHORT[player.position]}</span>
          <span className="text-theme-primary">
            {player.peakRating} rated
          </span>
          <span>{formatValue(player.value)}</span>
          {contract && <span>{formatWage(contract.wagePerYear)}/yr</span>}
          {contract && <span>{contract.yearsRemaining}yr left</span>}
          {slot && (
            <span>{slot.kind === "xiii" ? "Starter" : "Interchange"}</span>
          )}
          {(() => {
            const ps = career.squad.find((p) => p.playerId === playerId);
            if (!ps) return null;
            if (ps.injury) {
              return (
                <span className="col-span-2 text-red-300">
                  {formatInjuryLabel(ps.injury)}
                </span>
              );
            }
            return null;
          })()}
          {transferStatus?.listed && (
            <span className="col-span-2 text-accent-gold">
              Listed
              {transferStatus.listingType === "loan"
                ? " for loan"
                : transferStatus.listingType === "both"
                  ? " (sale or loan)"
                  : ""}{" "}
              — {formatWage(transferStatus.askingPrice)}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onReplace(playerId);
              onClose();
            }}
          >
            Substitute
          </GameButton>

          {!transferStatus?.listed && !showListForm && !loanedIn && (
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setShowListForm(true);
                setShowLoanForm(false);
              }}
            >
              List For Transfer
            </GameButton>
          )}

          {!transferStatus?.listed && !loanedIn && !showLoanForm && canLoanOut && (
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setShowLoanForm(false);
                setShowListForm(false);
                onUpdate(listPlayerForLoanWithOffers(career, playerId, 0));
              }}
            >
              List For Loan
            </GameButton>
          )}

          {!loanedIn && !showLoanForm && canLoanOut && loanDestinations.length > 0 && (
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setShowLoanForm(true);
                setShowListForm(false);
              }}
            >
              Loan Out Now
            </GameButton>
          )}

          {loanedIn && (
            <p className={`${TYPO.bodySm} text-amber-200`}>
              On loan — cannot list or sell permanently.
            </p>
          )}

          {transferStatus?.listed && (
            <GameButton variant="secondary" onClick={handleUnlist}>
              Remove From Transfer List
            </GameButton>
          )}

          {showListForm && (
            <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
              <label className={TYPO.bodySm}>
                <span className="text-pitch-400">Asking price</span>
                <input
                  type="number"
                  step={5000}
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
                />
              </label>
              <GameButton
                variant="theme"
                size="sm"
                className="mt-2"
                onClick={handleList}
              >
                Confirm Listing
              </GameButton>
            </div>
          )}

          {showLoanForm && canLoanOut && (
            <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
              <label className={TYPO.bodySm}>
                <span className="text-pitch-400">Loan to Championship club</span>
                <select
                  value={loanClub}
                  onChange={(e) => setLoanClub(e.target.value)}
                  className={`${FILTER.input} mt-1`}
                >
                  {loanDestinations.map((club) => (
                    <option key={club} value={club}>
                      {club}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`mt-3 block ${TYPO.bodySm}`}>
                <span className="text-pitch-400">Your wage share (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={loanParentSharePct}
                  onChange={(e) =>
                    setLoanParentSharePct(Number(e.target.value))
                  }
                  onBlur={() =>
                    setLoanParentSharePct(
                      normalizeLoanWageSharePct(loanParentSharePct)
                    )
                  }
                  className={`${FILTER.input} mt-1`}
                />
              </label>
              <p className={`mt-2 ${TYPO.meta} text-pitch-400`}>
                Season loan · recallable · set wage %
              </p>
              <GameButton
                variant="theme"
                size="sm"
                className="mt-2"
                onClick={handleLoanOut}
                disabled={!loanClub}
              >
                Confirm {normalizeLoanWageSharePct(loanParentSharePct)}% loan
              </GameButton>
            </div>
          )}

          {!loanedIn && (
            <GameButton variant="secondary" onClick={handleRelease}>
              Release ({formatWage(releaseCost)})
            </GameButton>
          )}

          <GameButton variant="secondary" onClick={onClose}>
            Close
          </GameButton>
        </div>
      </div>

      <ManagerDialog
        open={releaseConfirmOpen}
        variant="confirm"
        destructive
        title="Release player"
        message={releaseConfirmMessage}
        confirmLabel="Release"
        cancelLabel="Keep"
        onConfirm={confirmRelease}
        onCancel={() => setReleaseConfirmOpen(false)}
      />

      <ManagerDialog
        open={errorDialog !== null}
        title="Release failed"
        message={errorDialog ?? ""}
        onConfirm={() => setErrorDialog(null)}
        onCancel={() => setErrorDialog(null)}
      />
    </div>
  );
}
