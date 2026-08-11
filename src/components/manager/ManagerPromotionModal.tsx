"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getClubColors } from "@/lib/clubs";
import { getReadableClubTextColour } from "@/lib/ui/contrast";
import { getUserLeagueTablePosition } from "@/lib/manager/managerFixtures";
import { playSeasonComplete, playUiClick } from "@/lib/sound";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerPromotionModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerPromotionModal({
  career,
  onContinue,
}: ManagerPromotionModalProps) {
  const colors = getClubColors(career.club);
  const badgeTextColour = getReadableClubTextColour(colors);
  const position = getUserLeagueTablePosition(career);
  const champions = position === 1;
  const mpgWinners = career.millionPoundGame?.winner === career.club;

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    playSeasonComplete();
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} ${SPACING.safeBottom} overflow-y-auto sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`game-modal-panel w-full max-w-md max-h-[min(78dvh,720px)] overflow-y-auto overflow-x-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={managerModalHeaderClass("gold", { centered: true })}
          style={{
            background: `linear-gradient(to bottom, ${colors.primary}22, transparent)`,
          }}
        >
          <p className="text-5xl" aria-hidden>
            {champions ? "🏆" : "⬆️"}
          </p>
          <span className={`mt-3 ${managerPillClass("gold")}`}>
            {champions ? "Champions & promoted" : "Million Pound Game winners"}
          </span>
          <h2 id="promotion-title" className={`mt-3 ${TYPO.pageTitle}`}>
            {champions
              ? "Championship Champions"
              : "Promoted to Super League"}
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {champions
              ? `${career.club} finished 1st in ${career.seasonYear}.`
              : `${career.club} won the Million Pound Game in ${career.seasonYear}.`}
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          {champions
            ? "Title winners — Super League next season."
            : mpgWinners
              ? "Million Pound Game victory — Super League next season."
              : "Promotion secured — Super League next season."}
        </p>
        <p
          className={`mt-2 text-center text-[10px] font-bold uppercase tracking-wider`}
          style={{ color: badgeTextColour }}
        >
          Welcome to the top flight
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue
        </GameButton>
      </div>
    </div>
  );
}
