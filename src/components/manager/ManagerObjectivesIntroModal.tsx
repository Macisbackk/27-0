"use client";

import { useCallback } from "react";
import { ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerStat } from "@/components/manager/manager-ui";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { getManagerBoardObjectiveIntro } from "@/lib/manager/managerBoardObjectives";
import {
  managerClubAccentCardClass,
  managerClubAccentCardStyle,
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import type { ManagerCareer } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

interface ManagerObjectivesIntroModalProps {
  career: ManagerCareer;
  onContinue: () => void;
  onBack: () => void;
}

export function ManagerObjectivesIntroModal({
  career,
  onContinue,
  onBack,
}: ManagerObjectivesIntroModalProps) {
  const intro = getManagerBoardObjectiveIntro(career);

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const handleBack = useCallback(() => {
    playUiClick();
    onBack();
  }, [onBack]);

  const panelRef = useModalA11y(true, handleContinue);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center overflow-y-auto bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="objectives-intro-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass my-auto w-full max-w-lg overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={managerModalHeaderClass("primary")}>
          <span className={managerPillClass("primary")}>New career</span>
          <div className="mt-3 flex items-center gap-3">
            <ClubLogoBox club={career.club} size="sm" showAbbrev={false} />
            <div className="min-w-0 text-left">
              <h2 id="objectives-intro-title" className={TYPO.pageTitle}>
                Welcome to {intro.club}
              </h2>
              <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                Season {intro.seasonYear}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ManagerStat
            label="Club status"
            value={formatSquadRatingStars(intro.stars)}
            tone="gold"
          />
          <ManagerStat
            label="Board confidence"
            value={`${career.boardConfidence}%`}
            tone="primary"
          />
        </div>

        <div
          className={`mt-4 ${managerClubAccentCardClass()} ${SPACING.cardPaddingSm}`}
          style={managerClubAccentCardStyle(career.club)}
        >
          <p className={TYPO.sectionLabel}>Your board objective</p>
          <p className="mt-2 font-display text-xl font-bold uppercase tracking-wide text-white">
            {intro.primaryObjective}
          </p>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {intro.successDetail}
          </p>
        </div>

        <div className="mt-4">
          <p className={TYPO.sectionLabel}>Also on your radar</p>
          <ul className={`mt-2 ${SPACING.stackSm}`}>
            {intro.secondaryAims.map((aim) => (
              <li
                key={aim}
                className={`flex gap-2 ${TYPO.bodySm} leading-relaxed text-pitch-300`}
              >
                <span className="shrink-0 text-theme-primary" aria-hidden>
                  →
                </span>
                <span>{aim}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className={`mt-4 ${TYPO.bodySm} text-pitch-400`}>
          {intro.confidenceNote}
        </p>

        <div className={`mt-5 flex flex-col gap-2 sm:flex-row sm:items-center ${SPACING.buttonGap}`}>
          <GameButton variant="secondary" onClick={handleBack} className="sm:flex-1">
            Back
          </GameButton>
          <GameButton variant="theme" onClick={handleContinue} className="sm:flex-1">
            Let&apos;s get started
          </GameButton>
        </div>
      </div>
    </div>
  );
}
