"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { getClubColors } from "@/lib/clubs";
import { getReadableClubTextColour } from "@/lib/ui/contrast";
import { isUserInChampionship } from "@/lib/manager/leagueMembership";
import { playSeasonComplete, playUiClick } from "@/lib/sound";

interface ManagerLeagueWinnersModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerLeagueWinnersModal({
  career,
  onContinue,
}: ManagerLeagueWinnersModalProps) {
  const colors = getClubColors(career.club);
  const badgeTextColour = getReadableClubTextColour(colors);
  const inChamp = isUserInChampionship(career);

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
      labelledBy="league-winners-title"
      panelRef={panelRef}
      header={
        <div
          className="border-b text-center"
          style={{
            borderColor: `${colors.primary}66`,
            background: `linear-gradient(to bottom, ${colors.primary}22, transparent)`,
          }}
        >
          <p className="text-5xl" aria-hidden>
            🥇
          </p>
          <span
            className="mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: `${badgeTextColour}80`,
              backgroundColor: `${badgeTextColour}22`,
              color: badgeTextColour,
            }}
          >
            {inChamp ? "Championship" : "Regular season"}
          </span>
          <h2 id="league-winners-title" className={`mt-3 ${TYPO.pageTitle}`}>
            {inChamp ? "Championship Champions" : "League Leaders"}
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} finished top of the table in {career.seasonYear}.
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
        {inChamp
          ? "Title winners. Super League promotion secured."
          : "Top of the league — play-offs decide the title."}
      </p>
    </ManagerModal>
  );
}
