"use client";

import { useMemo } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { getClubColors } from "@/lib/clubs";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  formatSquadRatingStars,
  getAllManagerClubConfigs,
  squadRatingToStars,
} from "@/lib/manager/club-config";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
}

export function ManagerClubSelect({ onSelect, onBack }: ManagerClubSelectProps) {
  const clubs = useMemo(
    () =>
      getAllManagerClubConfigs().sort((a, b) => b.squadRating - a.squadRating),
    []
  );
  const allRatings = useMemo(
    () => clubs.map((club) => club.squadRating),
    [clubs]
  );

  return (
    <div className={`mx-auto max-w-xl ${SPACING.stackMd}`}>
      <div>
        <h1 className={`${TYPO.pageTitle} text-lg sm:text-xl`}>Choose Your Club</h1>
        <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
          Sorted by squad strength — tap to start your career.
        </p>
      </div>

      <ul className="space-y-1.5" role="list">
        {clubs.map((club) => {
          const attendance = getClubAttendanceProfile(club.name);
          const ratingStars = squadRatingToStars(club.squadRating, allRatings);
          const colors = getClubColors(club.name);

          return (
            <li key={club.name}>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onSelect(club.name);
                }}
                className={`${CARD.base} ${CARD.interactive} flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left sm:gap-3 sm:px-3`}
              >
                <span
                  className="w-1 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: colors.primary }}
                  aria-hidden
                />
                <ClubDualSwatch
                  club={club.name}
                  size="md"
                  primary={colors.primary}
                  secondary={colors.secondary}
                  className="hidden sm:flex"
                />
                <ClubDualSwatch
                  club={club.name}
                  size="sm"
                  primary={colors.primary}
                  secondary={colors.secondary}
                  className="sm:hidden"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {club.name}
                    </p>
                    <span
                      className="shrink-0 font-mono text-[11px] tracking-wide text-accent-gold"
                      aria-label={`${ratingStars} out of 5 stars`}
                    >
                      {formatSquadRatingStars(ratingStars)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-pitch-400">
                    {club.expectation}
                    <span className="text-pitch-600"> · </span>
                    £{(club.budget / 1000).toFixed(0)}k
                    <span className="text-pitch-600"> · </span>
                    ~{(attendance.base / 1000).toFixed(1)}k home
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold leading-none text-theme-primary">
                    {club.squadRating}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-pitch-500">
                    OVR
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <GameButton variant="secondary" onClick={onBack} fullWidth={false}>
        Back
      </GameButton>
    </div>
  );
}
