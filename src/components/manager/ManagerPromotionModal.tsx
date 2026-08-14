"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import { playSeasonComplete, playUiClick } from "@/lib/sound";
import {
  buildSeasonTransitionPreview,
  MILLION_POUND_GAME_NAME,
} from "@/lib/manager/seasonTransitionPreview";
import {
  managerModalHeaderClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerPromotionModalProps {
  career: ManagerCareer;
  onContinue: () => void;
}

function ClubList({
  label,
  clubs,
}: {
  label: string;
  clubs: string[];
}) {
  return (
    <div>
      <p className={`${TYPO.sectionLabel}`}>{label}</p>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-200`}>
        {clubs.length > 0 ? clubs.join(", ") : "None"}
      </p>
    </div>
  );
}

export function ManagerPromotionModal({
  career,
  onContinue,
}: ManagerPromotionModalProps) {
  const preview = buildSeasonTransitionPreview(career);

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
        <div className={managerModalHeaderClass("gold", { centered: true })}>
          <h2 id="promotion-title" className={`mt-1 ${TYPO.pageTitle}`}>
            Promotion & Relegation
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {preview.userHeadline ?? `${career.seasonYear} season complete.`}
          </p>
        </div>

        <div className={`${SPACING.stackMd} mt-4`}>
          <div>
            <p className={TYPO.sectionLabel}>Super League Playoffs</p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-200`}>
              Winner: {preview.slPlayoffWinner ?? "Not contested / pending"}
            </p>
          </div>
          <div>
            <p className={TYPO.sectionLabel}>Championship Playoffs</p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-200`}>
              Winner: {preview.champPlayoffWinner ?? "Pending"} — Million Pound Game qualifier
            </p>
          </div>
          <div>
            <p className={TYPO.sectionLabel}>{MILLION_POUND_GAME_NAME}</p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-200`}>
              {preview.mpg.slClub ?? "SL 11th"} vs {preview.mpg.champClub ?? "Champ playoff winner"}
            </p>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
              {preview.mpg.winner
                ? `${preview.mpg.winner} won. ${preview.mpg.outcome}`
                : preview.mpg.outcome}
            </p>
          </div>
          <ClubList label="Automatic Promotion" clubs={preview.autoPromoted} />
          <ClubList label="Million Pound Game Promotion" clubs={preview.mpgPromoted} />
          <ClubList label="Automatic Relegation" clubs={preview.autoRelegated} />
          <ClubList label="Million Pound Game Relegation" clubs={preview.mpgRelegated} />
        </div>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue to Season Review
        </GameButton>
      </div>
    </div>
  );
}
