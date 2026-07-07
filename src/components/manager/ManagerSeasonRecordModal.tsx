"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { ManagerCareer } from "@/lib/manager/types";
import type { ManagerSeasonRecordCelebrationKind } from "@/lib/manager/managerSeasonRecordCelebration";
import { getClubColors } from "@/lib/clubs";
import {
  playCupFinalLoss,
  playCupFinalWin,
  playUiClick,
} from "@/lib/sound";
import {
  managerModalHeaderClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";

interface ManagerSeasonRecordModalProps {
  career: ManagerCareer;
  kind: ManagerSeasonRecordCelebrationKind;
  onContinue: () => void;
}

const COPY: Record<
  ManagerSeasonRecordCelebrationKind,
  {
    emoji: string;
    pill: string;
    title: string;
    detail: string;
    headerTone: "gold" | "red";
    pillTone: "gold" | "red";
  }
> = {
  perfect: {
    emoji: "🏆",
    pill: "Perfect season",
    title: "27-0",
    detail:
      "Not a single defeat all season — a legendary league campaign.",
    headerTone: "gold",
    pillTone: "gold",
  },
  winless: {
    emoji: "💀",
    pill: "Winless season",
    title: "0-27",
    detail:
      "A season to forget — the board will be asking serious questions.",
    headerTone: "red",
    pillTone: "red",
  },
};

export function ManagerSeasonRecordModal({
  career,
  kind,
  onContinue,
}: ManagerSeasonRecordModalProps) {
  const colors = getClubColors(career.club);
  const copy = COPY[kind];
  const recordLabel = kind === "perfect" ? "27-0" : "0-27";

  const handleContinue = useCallback(() => {
    playUiClick();
    onContinue();
  }, [onContinue]);

  const panelRef = useModalA11y(true, handleContinue);

  useEffect(() => {
    if (kind === "perfect") playCupFinalWin();
    else playCupFinalLoss();
  }, [kind]);

  return (
    <div
      className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/80 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-record-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card-glass w-full max-w-md overflow-hidden outline-none ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={managerModalHeaderClass(copy.headerTone, { centered: true })}
          style={
            kind === "perfect"
              ? {
                  background: `linear-gradient(to bottom, ${colors.primary}22, transparent)`,
                }
              : undefined
          }
        >
          <p className="text-5xl" aria-hidden>
            {copy.emoji}
          </p>
          <span className={`mt-3 ${managerPillClass(copy.pillTone)}`}>
            {copy.pill}
          </span>
          <h2 id="season-record-title" className={`mt-3 ${TYPO.pageTitle}`}>
            {copy.title}
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
            {career.club} went {recordLabel} in {career.seasonYear}.
          </p>
        </div>

        <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
          {copy.detail}
        </p>

        <GameButton variant="theme" className="mt-5" onClick={handleContinue}>
          Continue
        </GameButton>
      </div>
    </div>
  );
}
