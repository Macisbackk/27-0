"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatWage } from "@/lib/manager/managerContracts";
import { playPanelClose } from "@/lib/sound";

export interface TransferResultDetails {
  playerName: string;
  club: string;
  fee: number;
  wagePerYear: number;
  years: number;
  accepted: boolean;
  reason: string;
}

interface ManagerTransferResultModalProps {
  result: TransferResultDetails;
  onClose: () => void;
}

export function ManagerTransferResultModal({
  result,
  onClose,
}: ManagerTransferResultModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playPanelClose();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        playPanelClose();
        onClose();
      }}
    >
      <div
        className={`card-glass w-full max-w-md ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={TYPO.cardTitle}>
          {result.accepted ? "Transfer Agreed" : "Transfer Rejected"}
        </h2>
        <div className={`mt-3 ${SPACING.stackSm} text-sm`}>
          <p className="font-medium text-white">{result.playerName}</p>
          <p className="text-pitch-400">From {result.club}</p>
          <p>Fee: {formatWage(result.fee)}</p>
          <p>
            Wage: {formatWage(result.wagePerYear)}/yr · {result.years} year
            {result.years === 1 ? "" : "s"}
          </p>
          <p
            className={
              result.accepted ? "text-theme-primary" : "text-red-300"
            }
          >
            {result.reason}
          </p>
        </div>
        <GameButton variant="theme" className="mt-4" onClick={onClose}>
          {result.accepted ? "Done" : "Close"}
        </GameButton>
      </div>
    </div>
  );
}
