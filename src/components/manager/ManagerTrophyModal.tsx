"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
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
    <ManagerModal
      open
      labelledBy="trophy-title"
      panelRef={panelRef}
      header={
        <div className={managerModalHeaderClass("gold", { centered: true, slotted: true })}>
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
      }
      footer={
        <GameButton variant="theme" onClick={handleContinue}>
          Continue
        </GameButton>
      }
    >
      <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
        You lifted the trophy at the Grand Final — a season to remember.
      </p>
    </ManagerModal>
  );
}
