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
  const isTopFlight = league.id === "super-league";

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
        className={`${CARD.elevated} ${CARD.interactive} ${
          isTopFlight ? CARD.featured : ""
        } flex w-full items-start gap-3 ${SPACING.cardPaddingSm} text-left disabled:pointer-events-none disabled:opacity-50`}
      >
        <span
          className={`mt-0.5 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${
            isTopFlight
              ? "border-accent-gold/45 bg-accent-gold/10 text-accent-gold"
              : "border-theme-primary/40 bg-theme-primary/10 text-theme-primary"
          }`}
          aria-hidden
        >
          <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
            {league.shortName}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className={TYPO.cardTitle}>{league.name}</p>
          <p className={`mt-1.5 ${TYPO.bodySm}`}>{league.bio}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={TYPO.meta}>
              {clubCount} club{clubCount === 1 ? "" : "s"}
            </span>
            <span className={TYPO.meta}>{league.seasonGames} fixtures</span>
            {league.hasPlayoffs ? (
              <span className={`${TYPO.meta} text-accent-gold`}>Playoffs</span>
            ) : (
              <span className={TYPO.meta}>Promotion race</span>
            )}
          </div>
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
  const league =
    club.competition === "championship" ? "championship" : "super-league";
  const maxStars = league === "championship" ? 3 : 5;

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
        className={`${CARD.base} ${CARD.interactive} flex w-full items-center gap-2.5 ${SPACING.listItem} text-left sm:gap-3 disabled:pointer-events-none disabled:opacity-50`}
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
              league={league}
              label={`${league === "championship" ? "Championship" : "Super League"} club rating: ${ratingStars} out of ${maxStars} stars`}
              size="sm"
            />
            <span className={TYPO.meta}>OVR {club.squadRating}</span>
          </div>
          <p className={`mt-0.5 truncate ${TYPO.bodySm}`}>
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
  league,
}: {
  clubs: ManagerClubConfig[];
  bios: Record<number, string>;
  onSelect: (club: string) => void;
  busy: boolean;
  league: "super-league" | "championship";
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

  const isChampionship = league === "championship";

  return (
    <div className={SPACING.stackMd}>
      {starGroups.map(({ stars, clubs: groupClubs }) => (
        <section
          key={stars}
          className={`${CARD.inset} ${SPACING.cardPaddingSm}`}
        >
          <h3
            className={`${TYPO.sectionLabel} ${
              isChampionship ? "text-sky-300" : "text-accent-gold"
            }`}
          >
            {isChampionship
              ? `Championship ${stars}★ clubs`
              : `${stars}-star clubs`}
          </h3>
          <p className={`mt-1 mb-3 ${TYPO.bodySm}`}>
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
      <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
        <div
          className={`${CARD.hero} ${CARD.featured} ${SPACING.cardPaddingLg} text-center`}
        >
          <p className={TYPO.sectionLabel}>New career</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Choose your league</h1>
          <p className={`mt-3 ${TYPO.body} text-pitch-300`}>
            Pick a competition, then choose the club you want to manage.
          </p>
        </div>

        <ul className={SPACING.stackMd} role="list">
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
          fullWidth
          disabled={busy}
        >
          Back
        </GameButton>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <div
        className={`${CARD.hero} ${CARD.featured} ${SPACING.cardPaddingLg} text-center`}
      >
        <p className={`${TYPO.sectionLabel} text-accent-gold`}>
          {selectedLeague.name}
        </p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>Choose your club</h1>
        <p className={`mt-3 ${TYPO.body} text-pitch-300`}>
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
        league={selectedLeague.id === "championship" ? "championship" : "super-league"}
      />

      <GameButton
        variant="secondary"
        onClick={() => {
          if (busy) return;
          playUiClick();
          setStep("league");
          setLeagueId(null);
        }}
        fullWidth
        disabled={busy}
      >
        Back to leagues
      </GameButton>
    </div>
  );
}
