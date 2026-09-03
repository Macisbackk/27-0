"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
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
  /** When set, this was a loan — wage shown is your share cost. */
  loanWageSharePct?: number;
}

interface ManagerTransferResultModalProps {
  result: TransferResultDetails;
  onClose: () => void;
}

export function ManagerTransferResultModal({
  result,
  onClose,
}: ManagerTransferResultModalProps) {
  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);

  return (
    <ManagerModal
      open
      onClose={handleClose}
      labelledBy="transfer-result-title"
      panelRef={panelRef}
      header={
        <div
          className={
            result.accepted
              ? "border-b border-theme-primary/30 bg-theme-primary/10"
              : "border-b border-red-500/30 bg-red-500/10"
          }
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
          <h2 id="transfer-result-title" className={`mt-2 ${TYPO.cardTitle}`}>
            {result.playerName}
          </h2>
          <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
            From <span className="text-white">{result.club}</span>
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <ManagerStat
          label="Transfer fee"
          value={
            result.loanWageSharePct != null
              ? "Loan"
              : result.freeTransfer || result.fee <= 0
                ? "Free"
                : formatWage(result.fee)
          }
          tone="gold"
        />
        <ManagerStat
          label={
            result.loanWageSharePct != null ? "Your wage cost" : "Wage"
          }
          value={`${formatWage(result.wagePerYear)}/yr`}
          tone="default"
        />
        {result.loanWageSharePct != null ? (
          <ManagerStat
            label="Your wage share"
            value={`${result.loanWageSharePct}%`}
            tone="muted"
          />
        ) : (
          <ManagerStat
            label="Contract"
            value={`${result.years} year${result.years === 1 ? "" : "s"}`}
            tone="muted"
          />
        )}
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
    </ManagerModal>
  );
}
