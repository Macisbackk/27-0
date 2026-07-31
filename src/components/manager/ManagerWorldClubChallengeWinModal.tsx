"use client";

import { useCallback, useEffect, useMemo } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getLatestUserWorldClubChallengeResult } from "@/lib/manager/worldClubChallenge";
import { playCupFinalWin, playUiClick } from "@/lib/sound";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerWorldClubChallengeWinModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerWorldClubChallengeWinModal({
  career,
  onContinue,
}: ManagerWorldClubChallengeWinModalProps) {
  const result = useMemo(
    () => getLatestUserWorldClubChallengeResult(career),
    [career]
  );

  useEffect(() => {
    playCupFinalWin();
  }, []);

  const scoreline =
    result != null ? `${result.homeScore}–${result.awayScore}` : null;

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wcc-win-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`game-modal-panel w-full max-w-md overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={managerModalHeaderClass("sky", {
            centered: true,
            wide: true,
          })}
        >
          <p className="text-5xl" aria-hidden>
            🌍
          </p>
          <span className={`mt-3 ${managerPillClass("sky")}`}>
            World Club Challenge
          </span>
          <h2 id="wcc-win-title" className={`mt-3 ${TYPO.pageTitle}`}>
            World Champions
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} have won the World Club Challenge in{" "}
            {career.seasonYear}
            {result ? ` — beat ${result.nrlChampionName}` : ""}
            {scoreline ? ` ${scoreline}` : "."}
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          Super League champions of the world — you beat the NRL title holders
          on the biggest club stage.
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue
        </GameButton>
      </div>
    </div>
  );
}
