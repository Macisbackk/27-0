"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { EraTeam, EraTeamCategory } from "@/lib/players/era-teams";
import {
  buildEra26Team,
  buildEraHistoricTeam,
  buildEraSquadFromRoster,
  ERA_26_YEAR,
  getEra26Clubs,
  getEraHistoricClubs,
  getEraHistoricYearsForClub,
  getEraSquadYear,
  isEra26Year,
} from "@/lib/players/era-teams";
import { formatValue } from "@/lib/players";
import { getClubColors } from "@/lib/clubs";
import { formatTeamRatingDisplay } from "@/lib/team-tiers";
import type { EraTournamentType } from "@/lib/storage/preferences";
import {
  getEraTournamentType,
  setEraTournamentType,
} from "@/lib/storage/preferences";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { ClubHeaderBar } from "./ClubBadge";
import { RugbyPitch } from "./RugbyPitch";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import {
  BTN,
  CARD,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface EraChallengeCupSelectProps {
  onConfirm: (team: EraTeam, tournamentType: EraTournamentType) => void;
}

const TOURNAMENT_OPTIONS: {
  value: EraTournamentType;
  label: string;
  description: string;
}[] = [
  {
    value: "onePerClub",
    label: "One Of Each Club",
    description:
      "Sixteen unique clubs — only one entry per club across 26 and historic teams.",
  },
  {
    value: "allTeams",
    label: "All Era Teams",
    description:
      "Any 26 or historic squad can be drawn — multiple seasons of the same club allowed.",
  },
];

export function EraChallengeCupSelect({ onConfirm }: EraChallengeCupSelectProps) {
  const [teamCategory, setTeamCategory] = useState<EraTeamCategory>("26");
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [tournamentType, setTournamentType] =
    useState<EraTournamentType>("allTeams");

  const clubs26 = useMemo(() => getEra26Clubs(), []);
  const clubsHistoric = useMemo(() => getEraHistoricClubs(), []);

  useEffect(() => {
    setTournamentType(getEraTournamentType());
  }, []);

  const clubs = teamCategory === "26" ? clubs26 : clubsHistoric;

  const years = useMemo(
    () =>
      teamCategory === "historic" && selectedClub
        ? getEraHistoricYearsForClub(selectedClub)
        : [],
    [teamCategory, selectedClub]
  );

  const previewTeam = useMemo(() => {
    if (!selectedClub) return null;
    if (teamCategory === "26") return buildEra26Team(selectedClub);
    if (!selectedYear) return null;
    return buildEraHistoricTeam(selectedClub, selectedYear);
  }, [teamCategory, selectedClub, selectedYear]);

  const previewSquad = useMemo(
    () =>
      previewTeam
        ? buildEraSquadFromRoster(
            previewTeam.playerIds,
            previewTeam.slotPositions,
            getEraSquadYear(previewTeam)
          )
        : null,
    [previewTeam]
  );

  const handleCategoryChange = (category: EraTeamCategory) => {
    playUiClick();
    setTeamCategory(category);
    setSelectedClub("");
    setSelectedYear("");
  };

  const handleClubSelect = (club: string) => {
    setSelectedClub(club);
    if (teamCategory === "26") {
      setSelectedYear(ERA_26_YEAR);
    } else {
      setSelectedYear("");
    }
  };

  const handleTournamentTypeChange = (type: EraTournamentType) => {
    playUiClick();
    setTournamentType(type);
    setEraTournamentType(type);
  };

  const handleConfirm = () => {
    if (previewTeam) onConfirm(previewTeam, tournamentType);
  };

  const showPreview = Boolean(previewTeam && previewSquad);
  const showHistoricYears =
    teamCategory === "historic" && selectedClub && years.length > 0;
  const is26Preview = previewTeam && isEra26Year(previewTeam.year);

  return (
    <div className={`mx-auto w-full max-w-3xl ${SPACING.pageX} py-6`}>
      <div className="text-center">
        <p className={TYPO.sectionLabel}>Challenge Cup</p>
        <h2 className={`mt-2 ${TYPO.pageTitle}`}>Choose Your Era</h2>
        <p className={`mx-auto mt-2 max-w-lg ${TYPO.body}`}>
          Pick a tournament type, team category, and squad to lead through a
          knockout draw against 26 and historic opponents.
        </p>
      </div>

      <div className={`${CARD.panel} mt-6 ${SPACING.cardPadding}`}>
        <p className={TYPO.statLabel}>Tournament Type</p>
        <div className="mt-3 space-y-2">
          {TOURNAMENT_OPTIONS.map((option) => {
            const active = tournamentType === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition ${
                  active
                    ? "border-accent-gold/50 bg-accent-gold/10"
                    : "border-pitch-700/60 bg-pitch-950/40 hover:border-pitch-500/50"
                }`}
              >
                <input
                  type="radio"
                  name="era-tournament-type"
                  value={option.value}
                  checked={active}
                  onChange={() => handleTournamentTypeChange(option.value)}
                  className="mt-1 shrink-0 accent-accent-gold"
                />
                <span className="min-w-0">
                  <span
                    className={`block font-semibold ${
                      active ? "text-accent-gold" : "text-white"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className={`mt-0.5 block ${TYPO.bodySm}`}>
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}>
        <p className={TYPO.statLabel}>Team Category</p>
        <div className={`mt-3 ${tabGroupClass(false, teamCategory === "26", teamCategory === "historic")}`}>
          <button
            type="button"
            onClick={() => handleCategoryChange("26")}
            className={tabGroupButtonClass(teamCategory === "26", "normal")}
          >
            26 Teams
          </button>
          <button
            type="button"
            onClick={() => handleCategoryChange("historic")}
            className={tabGroupButtonClass(teamCategory === "historic", "era")}
          >
            Historic Teams
          </button>
        </div>
        <p className={`mt-2 ${TYPO.bodySm} text-gray-500`}>
          {teamCategory === "26"
            ? "Current Super League squads — displayed as Club 26."
            : "Wikipedia-era squads — displayed as Club 'YY."}
        </p>
      </div>

      <div className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}>
        <p className={TYPO.statLabel}>
          {teamCategory === "26" ? "Select 26 Team" : "Select Club"}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {clubs.map((club) => {
            const colors = getClubColors(club);
            const active = selectedClub === club;
            const team =
              teamCategory === "26"
                ? buildEra26Team(club)
                : null;
            const hasSeasons =
              teamCategory === "26"
                ? team !== null
                : getEraHistoricYearsForClub(club).length > 0;
            return (
              <button
                key={club}
                type="button"
                disabled={!hasSeasons}
                onClick={() => handleClubSelect(club)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${TYPO.bodySm} transition ${
                  active
                    ? teamCategory === "26"
                      ? `${CARD.selected} border-accent-green/50 text-accent-green`
                      : `${CARD.selected} border-accent-gold/50 text-accent-gold`
                    : hasSeasons
                      ? `${CARD.base} text-gray-300 hover:border-pitch-500/50`
                      : `${CARD.base} cursor-not-allowed opacity-40 text-gray-500`
                }`}
              >
                <ClubDualSwatch club={club} size="xs" />
                <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                  {teamCategory === "26" ? `${club} 26` : club}
                </span>
                {teamCategory === "26" && team && (
                  <span className="shrink-0 text-[10px] text-gray-500">
                    {formatTeamRatingDisplay(team.teamRating, {
                      includeTier: false,
                    })}
                  </span>
                )}
                <span
                  className="ml-auto hidden h-3 w-3 rounded-full sm:inline"
                  style={{ backgroundColor: colors.primary }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {showHistoricYears && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}
        >
          <p className={TYPO.statLabel}>Select Season</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.map((year) => {
              const team = buildEraHistoricTeam(selectedClub, year);
              const active = selectedYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "border-accent-gold/50 bg-accent-gold/15 text-accent-gold"
                      : "border-pitch-600 bg-pitch-900/40 text-gray-300 hover:border-pitch-500"
                  }`}
                >
                  &apos;{year.slice(-2).padStart(2, "0")}
                  {team && (
                    <span className="ml-1 text-[10px] text-gray-500">
                      ({formatTeamRatingDisplay(team.teamRating, {
                        includeTier: false,
                      })})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {showPreview && previewTeam && previewSquad && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${CARD.panel} mt-4 ${SPACING.cardPaddingLg}`}
        >
          <div className="overflow-hidden rounded-xl border border-pitch-700/60">
            <ClubHeaderBar club={previewTeam.clubName} size="md" thick />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h3
              className={`${TYPO.cardTitle} ${
                is26Preview ? "text-accent-green" : "text-accent-gold"
              }`}
            >
              {previewTeam.displayName}
            </h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                is26Preview
                  ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                  : "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
              }`}
            >
              {is26Preview ? "26 Team" : "Historic"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <StatPill
              label="Rating"
              value={formatTeamRatingDisplay(previewTeam.teamRating, {
                includeTier: false,
              })}
            />
            <StatPill label="Tier" value={previewTeam.tier} />
            <StatPill label="Value" value={formatValue(previewTeam.teamValue)} />
          </div>

          {previewTeam.keyPlayers.length > 0 && (
            <p className={`mt-3 ${TYPO.bodySm}`}>
              Key players: {previewTeam.keyPlayers.join(", ")}
            </p>
          )}

          <div className={`${CARD.inset} mt-4 p-2 sm:p-4`}>
            <RugbyPitch
              squad={previewSquad}
              totalValue={getSquadValue(previewSquad)}
              filledCount={getFilledCount(previewSquad)}
              totalSlots={TOTAL_SLOTS}
              hideValueSummary
              clubColorOverride={previewTeam.clubName}
            />
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className={`mt-5 w-full ${BTN.base} ${BTN.primary}`}
          >
            Start Era Challenge Cup →
          </button>
        </motion.div>
      )}

      {selectedClub && teamCategory === "historic" && years.length === 0 && (
        <p className={`mt-4 text-center ${TYPO.bodySm} text-gray-500`}>
          No complete historic seasons available for {selectedClub}.
        </p>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${CARD.inset} rounded-lg px-3 py-2`}>
      <p className={TYPO.statLabel}>{label}</p>
      <p className={`mt-1 ${TYPO.bodySm} font-semibold text-white`}>{value}</p>
    </div>
  );
}
