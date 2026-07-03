"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { playCupFinalWin, playUiClick } from "@/lib/sound";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerTrophyModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerTrophyModal({
  career,
  onContinue,
}: ManagerTrophyModalProps) {
  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    playCupFinalWin();
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trophy-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-md overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("gold", { centered: true })}>
          <p className="text-5xl" aria-hidden>
            🏆
          </p>
          <span className={`mt-3 ${managerPillClass("gold")}`}>
            Champions
          </span>
          <h2 id="trophy-title" className={`mt-3 ${TYPO.pageTitle}`}>
            Super League Champions
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} have won the league title in {career.seasonYear}.
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          You lifted the trophy at the Grand Final — a season to remember.
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue
        </GameButton>
      </div>
    </div>
  );
}
