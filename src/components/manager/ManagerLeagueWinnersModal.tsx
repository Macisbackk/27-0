"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getClubColors } from "@/lib/clubs";
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

  useEffect(() => {
    playSeasonComplete();
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-winners-title"
    >
      <div
        className={`card-glass w-full max-w-md overflow-hidden ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="-mx-4 -mt-4 mb-4 border-b px-4 py-5 text-center sm:-mx-6 sm:-mt-6 sm:px-6"
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
              borderColor: `${colors.primary}80`,
              backgroundColor: `${colors.primary}22`,
              color: colors.primary,
            }}
          >
            Regular season
          </span>
          <h2 id="league-winners-title" className={`mt-3 ${TYPO.pageTitle}`}>
            League Leaders
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} finished top of the table in {career.seasonYear}.
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          You topped the league after the regular season — the play-offs decide
          who lifts the title.
        </p>

        <GameButton
          variant="theme"
          className="mt-5"
          onClick={() => {
            playUiClick();
            onContinue();
          }}
        >
          Continue
        </GameButton>
      </div>
    </div>
  );
}
