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
  type ManagerClubConfig,
} from "@/lib/manager/club-config";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
}

function ClubSelectRow({
  club,
  onSelect,
}: {
  club: ManagerClubConfig;
  onSelect: (club: string) => void;
}) {
  const attendance = getClubAttendanceProfile(club.name);
  const ratingStars = club.difficulty;
  const colors = getClubColors(club.name);

  return (
    <li>
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
}

export function ManagerClubSelect({ onSelect, onBack }: ManagerClubSelectProps) {
  const starGroups = useMemo(() => {
    const byStars = new Map<number, ManagerClubConfig[]>();

    for (const club of getAllManagerClubConfigs()) {
      const stars = club.difficulty;
      const group = byStars.get(stars) ?? [];
      group.push(club);
      byStars.set(stars, group);
    }

    return [...byStars.entries()]
      .sort(([a], [b]) => b - a)
      .map(([stars, clubs]) => ({
        stars,
        clubs: clubs.sort((a, b) => b.squadRating - a.squadRating),
      }));
  }, []);

  return (
    <div className={`mx-auto max-w-xl ${SPACING.stackMd}`}>
      <div>
        <h1 className={`${TYPO.pageTitle} text-lg sm:text-xl`}>Choose Your Club</h1>
        <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
          Grouped by club status — strongest sides first within each tier.
        </p>
      </div>

      <div className={SPACING.stackMd}>
        {starGroups.map(({ stars, clubs }) => (
          <section key={stars}>
            <h2
              className={`mb-1.5 flex items-center gap-2 ${TYPO.sectionLabel}`}
            >
              <span
                className="font-mono text-accent-gold"
                aria-label={`${stars} out of 5 stars`}
              >
                {formatSquadRatingStars(stars)}
              </span>
              <span className="text-pitch-500">
                {clubs.length} club{clubs.length === 1 ? "" : "s"}
              </span>
            </h2>
            <ul className="space-y-1.5" role="list">
              {clubs.map((club) => (
                <ClubSelectRow key={club.name} club={club} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <GameButton variant="secondary" onClick={onBack} fullWidth={false}>
        Back
      </GameButton>
    </div>
  );
}
