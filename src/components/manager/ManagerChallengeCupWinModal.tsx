"use client";

import { useCallback, useEffect, useMemo } from "react";
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

interface ManagerChallengeCupWinModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerChallengeCupWinModal({
  career,
  onContinue,
}: ManagerChallengeCupWinModalProps) {
  const finalWin = useMemo(() => {
    const cupFinals = career.fixtures.filter(
      (f) =>
        f.competition === "challenge_cup" &&
        f.meta?.cupRound === "final" &&
        f.result === "W"
    );
    return cupFinals[cupFinals.length - 1];
  }, [career.fixtures]);

  useEffect(() => {
    playCupFinalWin();
  }, []);

  const scoreline =
    finalWin != null
      ? `${finalWin.pointsFor}-${finalWin.pointsAgainst}`
      : null;

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  return (
    <ManagerModal
      open
      labelledBy="challenge-cup-win-title"
      panelRef={panelRef}
      header={
        <div
          className={managerModalHeaderClass("gold", {
            centered: true,
            wide: true,
            slotted: true,
          })}
        >
          <p className="text-5xl" aria-hidden>
            🏆
          </p>
          <span className={`mt-3 ${managerPillClass("gold")}`}>
            Challenge Cup
          </span>
          <h2 id="challenge-cup-win-title" className={`mt-3 ${TYPO.pageTitle}`}>
            Cup Winners
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} have won the Challenge Cup in {career.seasonYear}
            {finalWin ? ` — beat ${finalWin.opponent}` : ""}
            {scoreline ? ` ${scoreline}` : "."}
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
        You lifted the trophy at Wembley — a historic night for the club.
      </p>
    </ManagerModal>
  );
}
