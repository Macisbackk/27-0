"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ManagerStat } from "@/components/manager/manager-ui";
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

      <div className="grid items-stretch gap-3 sm:grid-cols-3">
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={`${CARD.elevated} ${SPACING.cardPadding} flex h-full flex-col`}
          >
            <div className="min-h-[3.25rem]">
              <p className="line-clamp-2 font-semibold leading-snug text-white">
                {choice.displayName}
              </p>
            </div>

            <div className="mt-2">
              <ManagerStat
                label="Opponent rating"
                value={String(choice.teamRating)}
                tone="primary"
              />
            </div>

            <p
              className={`mt-3 min-h-[2.5rem] line-clamp-2 ${TYPO.bodySm} text-pitch-400`}
            >
              {choice.description}
            </p>
            <p className="mt-2 min-h-[2.5rem] line-clamp-2 text-xs leading-relaxed text-pitch-500">
              {getFriendlyAttendanceInterest(choice, career)}
            </p>

            <div className="flex-1" aria-hidden />

            <GameButton
              variant="theme"
              size="sm"
              className="mt-4 shrink-0"
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
