"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { FriendlyOpponentChoice, ManagerCareer } from "@/lib/manager/types";
import { getFriendlyAttendanceInterest } from "@/lib/manager/managerFriendlies";
import { playUiClick } from "@/lib/sound";

interface ManagerFriendlySelectProps {
  career: ManagerCareer;
  friendlyNumber: number;
  choices: FriendlyOpponentChoice[];
  onSelect: (choiceId: string) => void;
}

export function ManagerFriendlySelect({
  career,
  friendlyNumber,
  choices,
  onSelect,
}: ManagerFriendlySelectProps) {
  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Choose Friendly Opponent</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Pre-season Friendly {friendlyNumber} of 2 — pick any club from your
          save · {career.club}
        </p>
      </div>

      <div className={`grid gap-3 sm:grid-cols-3`}>
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={`${CARD.elevated} ${SPACING.cardPadding}`}
          >
            <p className={`mt-1 font-medium text-white`}>{choice.displayName}</p>
            <p className={`mt-1 text-sm text-theme-primary`}>
              {choice.teamRating} rated
            </p>
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
              {choice.description}
            </p>
            <p className={`mt-1 text-xs text-pitch-500`}>
              {getFriendlyAttendanceInterest(choice, career)}
            </p>
            <GameButton
              variant="theme"
              size="sm"
              className="mt-3"
              onClick={() => {
                playUiClick();
                onSelect(choice.id);
              }}
            >
              Choose Opponent
            </GameButton>
          </div>
        ))}
      </div>
    </div>
  );
}
