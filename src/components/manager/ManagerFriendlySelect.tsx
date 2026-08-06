"use client";

import { GameButton } from "@/components/ui/GameButton";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { GameShortContent } from "@/components/ui/GameShortContent";
import {
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
  ManagerStat,
  ManagerViewHeader,
} from "@/components/manager/manager-ui";
import type { FriendlyOpponentChoice, ManagerCareer, ScheduledFriendly } from "@/lib/manager/types";
import {
  FRIENDLIES_REQUIRED,
  getFriendliesRequired,
} from "@/lib/manager/managerFriendlies";
import { getFriendlyAttendanceInterest } from "@/lib/manager/managerFriendlies";
import { getFriendlyOpponentBorderStyle } from "@/lib/manager/managerFriendlyUi";
import { playUiClick } from "@/lib/sound";

interface ManagerFriendlySelectProps {
  career: ManagerCareer;
  friendlyNumber: number;
  choices: FriendlyOpponentChoice[];
  draftSchedule?: ScheduledFriendly[];
  awaitingScheduleConfirm?: boolean;
  onSelect: (choiceId: string) => void;
  onBack?: () => void;
  onConfirmSchedule?: () => void;
}

export function ManagerFriendlySelect({
  career,
  friendlyNumber,
  choices,
  draftSchedule = [],
  awaitingScheduleConfirm = false,
  onSelect,
  onBack,
  onConfirmSchedule,
}: ManagerFriendlySelectProps) {
  const required = getFriendliesRequired(career);

  if (awaitingScheduleConfirm && draftSchedule.length >= required) {
    return (
      <ManagerPage>
        <ManagerSection>
          <ManagerViewHeader
            title="Confirm pre-season schedule"
            subtitle={`${required} friendlies arranged — review before your first match`}
          />
          <GameShortContent className="mb-4">
            <p className="text-sm text-pitch-400">
              Home and away venues are set for the full block. You can go back to
              change opponents before confirming.
            </p>
          </GameShortContent>
          <ol className="space-y-3">
            {draftSchedule.map((friendly, index) => (
              <li key={`${friendly.club}-${index}`}>
                <ManagerSectionCard
                  className="game-panel--kit-identity flex flex-col gap-2 !p-3.5 sm:!p-4"
                  style={getFriendlyOpponentBorderStyle(friendly.club)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-pitch-500">
                      Friendly {index + 1}
                    </span>
                    <ClubDualSwatch club={friendly.club} size="sm" />
                  </div>
                  <p className="font-semibold text-white">{friendly.displayName}</p>
                  <p className="text-sm text-pitch-400">
                    {friendly.isHome ? "Home" : "Away"} · Rating {friendly.teamRating}
                  </p>
                </ManagerSectionCard>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {onBack ? (
              <GameButton variant="secondary" onClick={onBack}>
                Back
              </GameButton>
            ) : null}
            {onConfirmSchedule ? (
              <GameButton
                variant="theme"
                onClick={() => {
                  playUiClick();
                  onConfirmSchedule();
                }}
              >
                Confirm schedule
              </GameButton>
            ) : null}
          </div>
        </ManagerSection>
      </ManagerPage>
    );
  }

  return (
    <ManagerPage>
      <ManagerSection>
        <ManagerViewHeader
          title="Choose Friendly Opponent"
          subtitle={`Friendly ${friendlyNumber} of ${required} · ${career.club}`}
        />

        {draftSchedule.length > 0 ? (
          <div className="mb-4 rounded-lg border border-pitch-700/50 bg-pitch-950/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-pitch-500">
              Scheduled so far
            </p>
            <ul className="mt-2 space-y-1 text-sm text-pitch-300">
              {draftSchedule.map((f, i) => (
                <li key={`${f.club}-${i}`}>
                  {i + 1}. {f.displayName} ({f.isHome ? "Home" : "Away"})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {choices.map((choice) => (
            <ManagerSectionCard
              key={choice.id}
              className="game-panel--kit-identity flex h-full flex-col !p-3.5 sm:!p-5"
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

              <p className="mt-3 line-clamp-2 min-h-[2.25rem] text-[0.72rem] leading-snug text-pitch-500">
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
      </ManagerSection>
    </ManagerPage>
  );
}

export { FRIENDLIES_REQUIRED };
