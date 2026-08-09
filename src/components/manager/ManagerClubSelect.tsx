"use client";

import { useMemo, useState } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { getClubColors } from "@/lib/clubs";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerClubConfig } from "@/lib/manager/club-config";
import {
  getClubsForPlayableLeague,
  getManagerPlayableLeague,
  listSelectableManagerLeagues,
  type ManagerPlayableLeagueDefinition,
} from "@/lib/manager/managerPlayableLeagues";
import type { ManagerCompetitionId } from "@/lib/manager/types";
import { getClubAttendanceProfile } from "@/lib/manager/managerAttendance";
import { ClubStarRatingDisplay } from "@/components/ui/ClubStarRating";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
  busy?: boolean;
}

type SelectStep = "league" | "club";

function LeagueSelectRow({
  league,
  clubCount,
  onSelect,
  disabled,
}: {
  league: ManagerPlayableLeagueDefinition;
  clubCount: number;
  onSelect: (id: ManagerCompetitionId) => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          playUiClick();
          onSelect(league.id);
        }}
        className={`${CARD.base} ${CARD.interactive} flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left disabled:pointer-events-none disabled:opacity-50`}
      >
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-pitch-600/70 bg-pitch-900/70 text-[10px] font-bold uppercase tracking-wide text-accent-gold"
          aria-hidden
        >
          {league.shortName}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{league.name}</p>
          <p className={`mt-1.5 ${TYPO.bodySm} text-pitch-400`}>{league.bio}</p>
          <p className="mt-2 text-[10px] uppercase tracking-wide text-pitch-500">
            {clubCount} club{clubCount === 1 ? "" : "s"}
          </p>
        </div>
      </button>
    </li>
  );
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
          <p className="truncate text-sm font-semibold text-white">{club.name}</p>
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
          <h3 className={`mb-2 ${TYPO.sectionLabel} text-accent-gold`}>
            {stars} star
          </h3>
          <p className={`mb-2.5 ${TYPO.bodySm} text-pitch-400`}>
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
  const [step, setStep] = useState<SelectStep>("league");
  const [leagueId, setLeagueId] = useState<ManagerCompetitionId | null>(null);

  const leagues = useMemo(() => listSelectableManagerLeagues(), []);
  const selectedLeague = leagueId
    ? getManagerPlayableLeague(leagueId)
    : undefined;
  const clubs = useMemo(
    () => (leagueId ? getClubsForPlayableLeague(leagueId) : []),
    [leagueId]
  );

  if (step === "league" || !selectedLeague) {
    return (
      <div className={`mx-auto max-w-xl ${SPACING.stackMd}`}>
        <div className="mb-1">
          <h1 className={`${TYPO.pageTitle} text-lg sm:text-xl`}>
            Choose Your League
          </h1>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
            Pick a competition, then choose the club you want to manage.
          </p>
        </div>

        <ul className="space-y-2.5" role="list">
          {leagues.map((league) => (
            <LeagueSelectRow
              key={league.id}
              league={league}
              clubCount={getClubsForPlayableLeague(league.id).length}
              onSelect={(id) => {
                setLeagueId(id);
                setStep("club");
              }}
              disabled={busy}
            />
          ))}
        </ul>

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

  return (
    <div className={`mx-auto max-w-xl ${SPACING.stackMd}`}>
      <div className="mb-1">
        <p className={`${TYPO.sectionLabel} text-accent-gold`}>
          {selectedLeague.name}
        </p>
        <h1 className={`mt-1.5 ${TYPO.pageTitle} text-lg sm:text-xl`}>
          Choose Your Club
        </h1>
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
          {selectedLeague.clubSelectBlurb}
        </p>
      </div>

      {busy && (
        <p className={`${TYPO.bodySm} text-center text-theme-primary`}>
          Starting your career…
        </p>
      )}

      <StarGroupedList
        clubs={clubs}
        bios={selectedLeague.starTierBios}
        onSelect={onSelect}
        busy={busy}
      />

      <GameButton
        variant="secondary"
        onClick={() => {
          if (busy) return;
          playUiClick();
          setStep("league");
          setLeagueId(null);
        }}
        fullWidth={false}
        disabled={busy}
      >
        Back to leagues
      </GameButton>
    </div>
  );
}
