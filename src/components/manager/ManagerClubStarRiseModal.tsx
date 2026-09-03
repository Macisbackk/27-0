"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { isUserInChampionship } from "@/lib/manager/leagueMembership";
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
  const league = isUserInChampionship(career)
    ? "championship"
    : "super-league";
  const starNoun = league === "championship" ? "Championship" : "";

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    playSeasonComplete();
  }, []);

  return (
    <ManagerModal
      open
      labelledBy="club-star-rise-title"
      panelRef={panelRef}
      header={
        <div
          className={managerModalHeaderClass("gold", {
            centered: true,
            slotted: true,
          })}
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
            {career.club} is now a {starNoun ? `${starNoun} ` : ""}
            {newStars}-star club
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {formatSquadRatingStars(previousStars, league)} →{" "}
            {formatSquadRatingStars(newStars, league)}
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
        Club rating up. Expectations rise.
      </p>
    </ManagerModal>
  );
}
