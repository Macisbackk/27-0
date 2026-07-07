"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { getClubColors } from "@/lib/clubs";
import { playSeasonComplete, playUiClick } from "@/lib/sound";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerClubStarRiseModalProps {
  career: ManagerCareer;
  previousStars: number;
  onContinue: () => void;
}

export function ManagerClubStarRiseModal({
  career,
  previousStars,
  onContinue,
}: ManagerClubStarRiseModalProps) {
  const colors = getClubColors(career.club);
  const newStars = getCareerClubStars(career);

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
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="club-star-rise-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-md overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={managerModalHeaderClass("gold", { centered: true })}
          style={{
            background: `linear-gradient(to bottom, ${colors.primary}22, transparent)`,
          }}
        >
          <p className="text-5xl" aria-hidden>
            ⭐
          </p>
          <span className={`mt-3 ${managerPillClass("gold")}`}>
            Club status rising
          </span>
          <h2 id="club-star-rise-title" className={`mt-3 ${TYPO.pageTitle}`}>
            {career.club} is now a {newStars}-star club
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {formatSquadRatingStars(previousStars)} →{" "}
            {formatSquadRatingStars(newStars)}
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          Results on the pitch, a stronger squad, and club upgrades have raised
          your reputation. Board expectations will increase.
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue
        </GameButton>
      </div>
    </div>
  );
}
