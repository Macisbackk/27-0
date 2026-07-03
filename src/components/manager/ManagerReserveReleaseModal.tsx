"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT } from "@/lib/positions";
import type { ManagerReservePlayer, PlayerContract } from "@/lib/manager/types";
import { formatWage } from "@/lib/manager/managerContracts";
import { getPotentialTier } from "@/lib/manager/managerReserves";
import { ManagerStat } from "@/components/manager/manager-ui";
import { playPanelClose, playUiClick } from "@/lib/sound";

interface ManagerReserveReleaseModalProps {
  reserve: ManagerReservePlayer;
  contract: PlayerContract | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ManagerReserveReleaseModal({
  reserve,
  contract,
  onCancel,
  onConfirm,
}: ManagerReserveReleaseModalProps) {
  const [released, setReleased] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playPanelClose();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleConfirm = () => {
    playUiClick();
    onConfirm();
    setReleased(true);
  };

  const handleDone = () => {
    playPanelClose();
    onCancel();
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-release-title"
      onClick={() => {
        playPanelClose();
        onCancel();
      }}
    >
      <div
        className={`card-glass w-full max-w-md overflow-hidden ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`-mx-4 -mt-4 mb-4 border-b px-4 py-3 sm:-mx-6 sm:-mt-6 sm:px-6 ${
            released
              ? "border-pitch-600/40 bg-pitch-800/40"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              released
                ? "border-pitch-500/45 bg-pitch-700/30 text-pitch-300"
                : "border-red-400/45 bg-red-500/15 text-red-300"
            }`}
          >
            {released ? "Released" : "Release player"}
          </span>
          <h2 id="reserve-release-title" className={`mt-2 ${TYPO.cardTitle}`}>
            {reserve.name}
          </h2>
          <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
            {POSITION_SHORT[reserve.position]} · Age {reserve.age} ·{" "}
            {reserve.nationality}
          </p>
        </div>

        {!released ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ManagerStat
                label="Rating"
                value={String(reserve.rating)}
                tone="primary"
              />
              <ManagerStat
                label="Potential"
                value={String(reserve.potentialRating)}
                tone="gold"
              />
              <ManagerStat
                label="Reserve apps"
                value={String(reserve.reserveAppearances)}
                tone="default"
              />
              <ManagerStat
                label="Reserve tries"
                value={String(reserve.reserveTries)}
                tone="primary"
              />
              {contract && (
                <>
                  <ManagerStat
                    label="Wage"
                    value={`${formatWage(contract.wagePerYear)}/yr`}
                    tone="default"
                  />
                  <ManagerStat
                    label="Contract"
                    value={`${contract.yearsRemaining}yr left`}
                    tone="muted"
                  />
                </>
              )}
            </div>

            <p className={`mt-3 ${TYPO.bodySm} text-pitch-400`}>
              {getPotentialTier(reserve.potentialRating)} prospect — releasing
              removes them from your reserve squad
              {contract
                ? ` and clears ${formatWage(contract.wagePerYear)}/yr from the wage bill`
                : ""}
              .
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <GameButton variant="secondary" onClick={handleDone}>
                Cancel
              </GameButton>
              <GameButton variant="theme" onClick={handleConfirm}>
                Confirm release
              </GameButton>
            </div>
          </>
        ) : (
          <>
            <p className={`${TYPO.bodySm} text-pitch-300`}>
              <span className="font-semibold text-white">{reserve.name}</span>{" "}
              has left the club. Their youth contract has been terminated and
              they are no longer in your reserves.
            </p>
            {contract && (
              <p className={`mt-2 ${TYPO.bodySm} text-theme-primary`}>
                Wage bill reduced by {formatWage(contract.wagePerYear)}/yr.
              </p>
            )}
            <GameButton variant="theme" className="mt-4" onClick={handleDone}>
              Done
            </GameButton>
          </>
        )}
      </div>
    </div>
  );
}
