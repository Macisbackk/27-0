"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { EraTeam } from "@/lib/players/era-teams";
import {
  buildEraSquadFromRoster,
  buildEraTeamForYear,
  getEraClubsWithTeams,
  getEraSquadYear,
  getEraYearsForClubUnified,
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
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
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
      "Fourteen unique clubs — only one entry per club across all era squads.",
  },
  {
    value: "allTeams",
    label: "All Era Teams",
    description:
      "Any era squad can be drawn — multiple seasons of the same club allowed.",
  },
];

export function EraChallengeCupSelect({ onConfirm }: EraChallengeCupSelectProps) {
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [tournamentType, setTournamentType] =
    useState<EraTournamentType>("allTeams");

  const clubs = useMemo(() => getEraClubsWithTeams(), []);

  useEffect(() => {
    setTournamentType(getEraTournamentType());
  }, []);

  const years = useMemo(
    () => (selectedClub ? getEraYearsForClubUnified(selectedClub) : []),
    [selectedClub]
  );

  const previewTeam = useMemo(() => {
    if (!selectedClub || !selectedYear) return null;
    return buildEraTeamForYear(selectedClub, selectedYear);
  }, [selectedClub, selectedYear]);

  const previewSquad = useMemo(
    () =>
      previewTeam
        ? buildEraSquadFromRoster(
            previewTeam.playerIds,
            previewTeam.slotPositions,
            getEraSquadYear(previewTeam),
            previewTeam.displayName
          )
        : null,
    [previewTeam]
  );

  const handleClubSelect = (club: string) => {
    playUiClick();
    setSelectedClub(club);
    const clubYears = getEraYearsForClubUnified(club);
    setSelectedYear(clubYears[0] ?? "");
  };

  const handleTournamentTypeChange = (type: EraTournamentType) => {
    playUiClick();
    setTournamentType(type);
    setEraTournamentType(type);
  };

  const handleConfirm = () => {
    if (previewTeam) onConfirm(previewTeam, tournamentType);
  };

  const showYears = selectedClub && years.length > 0;
  const showTournamentAndPreview = Boolean(
    selectedClub && selectedYear && previewTeam && previewSquad
  );

  return (
    <div className={`mx-auto w-full max-w-xl ${SPACING.pageX} py-6`}>
      <div
        className={`${CARD.glass} ${CARD.panel} w-full ${SPACING.cardPaddingLg} transition hover:border-accent-gold/30`}
      >
        <h2 className={TYPO.cardTitle}>Challenge Cup</h2>
        <p className={`mt-3 ${TYPO.body}`}>
          Pick a historic club season and lead that era squad through a knockout
          draw against opponents from across the decades.
        </p>

        <p className={`mt-5 ${TYPO.statLabel}`}>Select Club</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {clubs.map((club) => {
            const colors = getClubColors(club);
            const active = selectedClub === club;
            const hasSeasons = getEraYearsForClubUnified(club).length > 0;
            return (
              <button
                key={club}
                type="button"
                disabled={!hasSeasons}
                onClick={() => handleClubSelect(club)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${TYPO.bodySm} transition ${
                  active
                    ? `${CARD.selected} border-accent-gold/50 text-accent-gold`
                    : hasSeasons
                      ? `${CARD.base} text-gray-300 hover:border-pitch-500/50`
                      : `${CARD.base} cursor-not-allowed opacity-40 text-gray-500`
                }`}
              >
                <ClubDualSwatch club={club} size="xs" />
                <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                  {club}
                </span>
                <span
                  className="ml-auto hidden h-3 w-3 shrink-0 rounded-full sm:inline"
                  style={{ backgroundColor: colors.primary }}
                />
              </button>
            );
          })}
        </div>

        {showYears && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            <p className={TYPO.statLabel}>Select Season</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {years.map((year) => {
                const team = buildEraTeamForYear(selectedClub, year);
                const active = selectedYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      playUiClick();
                      setSelectedYear(year);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? "border-accent-gold/50 bg-accent-gold text-pitch-950 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                        : "border-pitch-600 bg-pitch-900/40 text-gray-300 hover:border-pitch-500"
                    }`}
                  >
                    &apos;{year.slice(-2).padStart(2, "0")}
                    {team && (
                      <span
                        className={`ml-1 text-[10px] ${
                          active ? "text-pitch-800" : "text-gray-500"
                        }`}
                      >
                        (
                        {formatTeamRatingDisplay(team.teamRating, {
                          includeTier: false,
                        })}
                        )
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {showTournamentAndPreview && previewTeam && previewSquad && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            <div className="overflow-hidden rounded-xl border border-pitch-700/60">
              <ClubHeaderBar club={previewTeam.clubName} size="md" thick />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h3 className={`${TYPO.cardTitle} text-accent-gold`}>
                {previewTeam.displayName}
              </h3>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <StatPill
                label="Rating"
                value={formatTeamRatingDisplay(previewTeam.teamRating, {
                  includeTier: false,
                })}
              />
              <StatPill label="Tier" value={previewTeam.tier} />
              <StatPill
                label="Value"
                value={formatValue(previewTeam.teamValue)}
              />
            </div>

            {previewTeam.keyPlayers.length > 0 && (
              <p className={`mt-3 ${TYPO.bodySm}`}>
                Key players: {previewTeam.keyPlayers.join(", ")}
              </p>
            )}

            <div className={`${CARD.inset} mt-4 overflow-x-hidden p-2 sm:p-4`}>
              <RugbyPitch
                squad={previewSquad}
                totalValue={getSquadValue(previewSquad)}
                filledCount={getFilledCount(previewSquad)}
                totalSlots={TOTAL_SLOTS}
                hideValueSummary
                clubColorOverride={previewTeam.clubName}
              />
            </div>

            <p className={`mt-5 ${TYPO.statLabel}`}>Tournament Type</p>
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

            <button
              type="button"
              onClick={handleConfirm}
              className={`mt-5 w-full ${BTN.base} ${BTN.goldOutline}`}
            >
              Start Era Challenge Cup →
            </button>
          </motion.div>
        )}

        {selectedClub && years.length === 0 && (
          <p className={`mt-4 text-center ${TYPO.bodySm} text-gray-500`}>
            No complete era seasons available for {selectedClub}.
          </p>
        )}
      </div>
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
