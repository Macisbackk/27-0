"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ManagerStat } from "@/components/manager/manager-ui";
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
  freeTransfer?: boolean;
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
      className={`fixed inset-0 z-[90] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      onClick={() => {
        playPanelClose();
        onClose();
      }}
    >
      <div
        className={`card-glass w-full max-w-md overflow-hidden ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`-mx-4 -mt-4 mb-4 border-b px-4 py-3 sm:-mx-6 sm:-mt-6 sm:px-6 ${
            result.accepted
              ? "border-theme-primary/30 bg-theme-primary/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              result.accepted
                ? "border-theme-primary/45 bg-theme-primary/15 text-theme-primary"
                : "border-red-400/45 bg-red-500/15 text-red-300"
            }`}
          >
            {result.accepted ? "Deal agreed" : "Bid rejected"}
          </span>
          <h2 className={`mt-2 ${TYPO.cardTitle}`}>{result.playerName}</h2>
          <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
            From <span className="text-white">{result.club}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ManagerStat
            label="Transfer fee"
            value={result.freeTransfer || result.fee <= 0 ? "Free" : formatWage(result.fee)}
            tone="gold"
          />
          <ManagerStat
            label="Wage"
            value={`${formatWage(result.wagePerYear)}/yr`}
            tone="default"
          />
          <ManagerStat
            label="Contract"
            value={`${result.years} year${result.years === 1 ? "" : "s"}`}
            tone="muted"
          />
        </div>

        <p
          className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${
            result.accepted
              ? "border-theme-primary/35 bg-theme-primary/8 text-theme-primary"
              : "border-red-500/35 bg-red-500/8 text-red-200"
          }`}
        >
          {result.reason}
        </p>

        <GameButton variant="theme" className="mt-4" onClick={onClose}>
          {result.accepted ? "Done" : "Close"}
        </GameButton>
      </div>
    </div>
  );
}
