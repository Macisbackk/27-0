"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { EraTeam } from "@/lib/players/era-teams";
import {
  buildEraSquadFromRoster,
  buildEraTeam,
  getEraClubs,
  getEraYearsForClub,
} from "@/lib/players/era-teams";
import { formatValue } from "@/lib/players";
import { getClubColors } from "@/lib/clubs";
import { formatTeamRatingDisplay } from "@/lib/team-tiers";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { ClubHeaderBar } from "./ClubBadge";
import { RugbyPitch } from "./RugbyPitch";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface EraChallengeCupSelectProps {
  onConfirm: (team: EraTeam) => void;
}

export function EraChallengeCupSelect({ onConfirm }: EraChallengeCupSelectProps) {
  const clubs = useMemo(() => getEraClubs(), []);
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const years = useMemo(
    () => (selectedClub ? getEraYearsForClub(selectedClub) : []),
    [selectedClub]
  );

  const previewTeam = useMemo(() => {
    if (!selectedClub || !selectedYear) return null;
    return buildEraTeam(selectedClub, selectedYear);
  }, [selectedClub, selectedYear]);

  const previewSquad = useMemo(
    () => (previewTeam ? buildEraSquadFromRoster(previewTeam.playerIds) : null),
    [previewTeam]
  );

  const handleClubSelect = (club: string) => {
    setSelectedClub(club);
    setSelectedYear("");
  };

  const handleConfirm = () => {
    if (previewTeam) onConfirm(previewTeam);
  };

  return (
    <div className={`mx-auto w-full max-w-3xl ${SPACING.pageX} py-6`}>
      <div className="text-center">
        <p className={TYPO.sectionLabel}>Era Challenge Cup</p>
        <h2 className={`mt-2 ${TYPO.pageTitle}`}>Choose Your Era</h2>
        <p className={`mx-auto mt-2 max-w-lg ${TYPO.body}`}>
          Pick a club and historic season to lead a pre-built squad through a
          knockout tournament against random era opponents.
        </p>
      </div>

      <div className={`${CARD.panel} mt-6 ${SPACING.cardPadding}`}>
        <p className={TYPO.statLabel}>Select Club</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {clubs.map((club) => {
            const colors = getClubColors(club);
            const active = selectedClub === club;
            return (
              <button
                key={club}
                type="button"
                onClick={() => handleClubSelect(club)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${TYPO.bodySm} transition ${
                  active
                    ? `${CARD.selected} border-accent-green/50 text-accent-green`
                    : `${CARD.base} text-gray-300 hover:border-pitch-500/50`
                }`}
              >
                <ClubDualSwatch club={club} size="xs" />
                <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                  {club}
                </span>
                <span
                  className="ml-auto hidden h-3 w-3 rounded-full sm:inline"
                  style={{ backgroundColor: colors.primary }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {selectedClub && years.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${CARD.panel} mt-4 ${SPACING.cardPadding}`}
        >
          <p className={TYPO.statLabel}>Select Season</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.map((year) => {
              const team = buildEraTeam(selectedClub, year);
              const active = selectedYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "border-accent-green/50 bg-accent-green/15 text-accent-green"
                      : "border-pitch-600 bg-pitch-900/40 text-gray-300 hover:border-pitch-500"
                  }`}
                >
                  {year}
                  {team && !team.complete && (
                    <span className="ml-1 text-[10px] text-accent-gold">
                      ({team.playerIds.length}/13)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {previewTeam && previewSquad && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${CARD.panel} mt-4 ${SPACING.cardPaddingLg}`}
        >
          <div className="overflow-hidden rounded-xl border border-pitch-700/60">
            <ClubHeaderBar club={previewTeam.clubName} size="md" thick />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h3 className={`${TYPO.cardTitle} text-accent-gold`}>
              {previewTeam.displayName}
            </h3>
            {!previewTeam.complete && (
              <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-gold">
                Incomplete Squad
              </span>
            )}
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

      {selectedClub && years.length === 0 && (
        <p className={`mt-4 text-center ${TYPO.bodySm} text-gray-500`}>
          No seasons with enough squad data for {selectedClub}.
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
