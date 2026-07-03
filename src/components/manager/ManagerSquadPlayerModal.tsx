"use client";

import { useCallback, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import { formatWage } from "@/lib/manager/managerContracts";
import {
  computeReleaseCost,
  listPlayerForTransferWithOffers,
  releasePlayerWithCost,
  suggestedAskingPrice,
  unlistPlayerFromTransfer,
} from "@/lib/manager/managerTransferLeague";
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

  if (!player) return null;

  const handleList = () => {
    onUpdate(listPlayerForTransferWithOffers(career, playerId, askingPrice));
    setShowListForm(false);
  };

  const handleUnlist = () => {
    onUpdate(unlistPlayerFromTransfer(career, playerId));
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
      className={`fixed inset-0 z-[90] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-md outline-none ${SPACING.cardPadding}`}
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
            if (ps.fitness < 75) {
              return (
                <span className="col-span-2 text-amber-300">
                  Fitness {Math.round(ps.fitness)}% — may need rest
                </span>
              );
            }
            return null;
          })()}
          {transferStatus?.listed && (
            <span className="col-span-2 text-accent-gold">
              Listed — {formatWage(transferStatus.askingPrice)}
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
            Replace Player
          </GameButton>

          {!transferStatus?.listed && !showListForm && (
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setShowListForm(true);
              }}
            >
              List For Transfer
            </GameButton>
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

          <GameButton variant="secondary" onClick={handleRelease}>
            Release ({formatWage(releaseCost)})
          </GameButton>

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
