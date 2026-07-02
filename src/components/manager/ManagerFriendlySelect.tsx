"use client";

import { GameButton } from "@/components/ui/GameButton";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  ManagerPage,
  ManagerSectionCard,
  ManagerStat,
  ManagerViewHeader,
} from "@/components/manager/manager-ui";
import type { FriendlyOpponentChoice, ManagerCareer } from "@/lib/manager/types";
import { getFriendlyAttendanceInterest } from "@/lib/manager/managerFriendlies";
import { getFriendlyOpponentBorderStyle } from "@/lib/manager/managerFriendlyUi";
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
    <ManagerPage>
      <ManagerViewHeader
        title="Choose Friendly Opponent"
        subtitle={`Pre-season Friendly ${friendlyNumber} of 2 — pick any club from your save · ${career.club}`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {choices.map((choice) => (
          <ManagerSectionCard
            key={choice.id}
            className="flex h-full flex-col !p-3.5 sm:!p-5"
            style={getFriendlyOpponentBorderStyle(choice.club)}
          >
            <div className="flex min-h-[1.25rem] items-center gap-2">
              <ClubDualSwatch club={choice.club} size="sm" />
            </div>

            <div className="mt-3 min-h-[2.75rem]">
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
              className={`mt-3 min-h-[2.5rem] line-clamp-3 ${TYPO.managerBody}`}
            >
              {choice.description}
            </p>
            <p className={`mt-2 line-clamp-2 ${TYPO.managerBody}`}>
              {getFriendlyAttendanceInterest(choice, career)}
            </p>

            <div className="flex-1" aria-hidden />

            <GameButton
              variant="theme"
              size="sm"
              className="mt-4 w-full shrink-0"
              onClick={() => {
                playUiClick();
                onSelect(choice.id);
              }}
            >
              Choose Opponent
            </GameButton>
          </ManagerSectionCard>
        ))}
      </div>
    </ManagerPage>
  );
}
