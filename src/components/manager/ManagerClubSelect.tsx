"use client";

import { useMemo } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { getClubColors } from "@/lib/clubs";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  CHAMPIONSHIP_STAR_TIER_BIOS,
  getAllManagerClubConfigs,
  MANAGER_STAR_TIER_BIOS,
  type ManagerClubConfig,
} from "@/lib/manager/club-config";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { ClubStarRatingDisplay } from "@/components/ui/ClubStarRating";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
  busy?: boolean;
}

function ClubSelectRow({
  club,
  onSelect,
  disabled,
}: {
  club: ManagerClubConfig;
  onSelect: (club: string) => void;
  disabled?: boolean;
}) {
  const attendance = getClubAttendanceProfile(club.name);
  const ratingStars = club.difficulty;
  const colors = getClubColors(club.name);
  const isChamp = club.competition === "championship";

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          playUiClick();
          onSelect(club.name);
        }}
        className={`${CARD.base} ${CARD.interactive} flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left sm:gap-3 sm:px-3 disabled:pointer-events-none disabled:opacity-50`}
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
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
            <span className="truncate">{club.name}</span>
            {isChamp ? (
              <span className="shrink-0 rounded border border-pitch-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-pitch-300">
                Champ
              </span>
            ) : null}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <ClubStarRatingDisplay
              stars={ratingStars}
              label={`Club rating: ${ratingStars} out of 5 stars`}
              size="sm"
            />
            <span className="text-[10px] uppercase tracking-wide text-pitch-500">
              OVR {club.squadRating}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-pitch-400">
            {club.expectation}
            <span className="text-pitch-600"> · </span>
            £{(club.budget / 1000).toFixed(0)}k
            <span className="text-pitch-600"> · </span>
            ~{(attendance.base / 1000).toFixed(1)}k home
          </p>
        </div>
      </button>
    </li>
  );
}

function StarGroupedList({
  clubs,
  bios,
  onSelect,
  busy,
}: {
  clubs: ManagerClubConfig[];
  bios: Record<number, string>;
  onSelect: (club: string) => void;
  busy: boolean;
}) {
  const starGroups = useMemo(() => {
    const byStars = new Map<number, ManagerClubConfig[]>();
    for (const club of clubs) {
      const stars = club.difficulty;
      const group = byStars.get(stars) ?? [];
      group.push(club);
      byStars.set(stars, group);
    }
    return [...byStars.entries()]
      .sort(([a], [b]) => b - a)
      .map(([stars, group]) => ({
        stars,
        clubs: group.sort((a, b) => b.squadRating - a.squadRating),
      }));
  }, [clubs]);

  return (
    <div className={SPACING.stackMd}>
      {starGroups.map(({ stars, clubs: groupClubs }) => (
        <section key={stars}>
          <h3 className={`mb-1 ${TYPO.sectionLabel} text-accent-gold`}>
            {stars} star
          </h3>
          <p className={`mb-1.5 ${TYPO.bodySm} text-pitch-400`}>
            {bios[stars] ?? "Board expectations scale with club status."}
          </p>
          <ul className="space-y-1.5" role="list">
            {groupClubs.map((club) => (
              <ClubSelectRow
                key={club.name}
                club={club}
                onSelect={onSelect}
                disabled={busy}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ManagerClubSelect({
  onSelect,
  onBack,
  busy = false,
}: ManagerClubSelectProps) {
  const { slClubs, champClubs } = useMemo(() => {
    const all = getAllManagerClubConfigs();
    return {
      slClubs: all.filter((c) => c.competition !== "championship"),
      champClubs: all.filter((c) => c.competition === "championship"),
    };
  }, []);

  return (
    <div className={`mx-auto max-w-xl ${SPACING.stackMd}`}>
      <div>
        <h1 className={`${TYPO.pageTitle} text-lg sm:text-xl`}>Choose Your Club</h1>
        <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
          Super League first — Championship clubs can earn promotion.
        </p>
      </div>

      {busy && (
        <p className={`${TYPO.bodySm} text-center text-theme-primary`}>
          Starting your career…
        </p>
      )}

      <section className={SPACING.stackMd}>
        <h2 className={`${TYPO.sectionLabel} text-white`}>Super League</h2>
        <StarGroupedList
          clubs={slClubs}
          bios={MANAGER_STAR_TIER_BIOS}
          onSelect={onSelect}
          busy={busy}
        />
      </section>

      {champClubs.length > 0 ? (
        <section className={SPACING.stackMd}>
          <div>
            <h2 className={`${TYPO.sectionLabel} text-white`}>Championship</h2>
            <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
              Championship — earn promotion
            </p>
          </div>
          <StarGroupedList
            clubs={champClubs}
            bios={CHAMPIONSHIP_STAR_TIER_BIOS}
            onSelect={onSelect}
            busy={busy}
          />
        </section>
      ) : null}

      <GameButton
        variant="secondary"
        onClick={onBack}
        fullWidth={false}
        disabled={busy}
      >
        Back
      </GameButton>
    </div>
  );
}
