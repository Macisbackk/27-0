"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { ClubBreakdownSummary } from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { RLClubRow } from "./cards/RLClubRow";
import { RugbyPitch } from "./RugbyPitch";
import { ClubHeaderBar } from "./ClubBadge";
import { playPanelExpand } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubPillBackground } from "@/lib/ui/contrast";

interface ClubRepresentationProps {
  summary: ClubBreakdownSummary;
  /** Full squad for pitch-style lineup view. */
  squad?: SquadSlot[];
  /** Era mode: apply era team colours to all club rows. */
  clubColorOverride?: string;
  /** Era mode: display name for the selected era team. */
  eraTeamLabel?: string;
}

function FormationPanel({
  squad,
  clubColorOverride,
  eraTeamLabel,
  accentColors,
}: {
  squad: SquadSlot[];
  clubColorOverride?: string;
  eraTeamLabel?: string;
  accentColors?: ReturnType<typeof getClubColors>;
}) {
  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm}`}
      style={
        accentColors
          ? {
              borderColor: `${getClubPillBackground(accentColors.primary, accentColors.secondary, accentColors.accent)}55`,
              background: `linear-gradient(135deg, ${accentColors.primary}18 0%, rgba(15,23,42,0.9) 55%)`,
            }
          : undefined
      }
    >
      {eraTeamLabel && (
        <div className="mb-3 text-center">
          {clubColorOverride && (
            <div className="mx-auto mb-2 max-w-xs overflow-hidden rounded-lg">
              <ClubHeaderBar club={clubColorOverride} size="sm" thick />
            </div>
          )}
          <p className="font-display text-base font-bold text-accent-gold sm:text-lg">
            {eraTeamLabel}
          </p>
        </div>
      )}
      <RugbyPitch
        squad={squad}
        totalValue={getSquadValue(squad)}
        filledCount={getFilledCount(squad)}
        totalSlots={TOTAL_SLOTS}
        formationOnly
        hideValueSummary
        clubColorOverride={clubColorOverride}
      />
    </div>
  );
}

export function ClubRepresentation({
  summary,
  squad,
  clubColorOverride,
  eraTeamLabel,
}: ClubRepresentationProps) {
  const { clubs, totalPlayers, expectedPlayers, isValid } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(
    clubs.length === 1 ? clubs[0]!.club : null
  );

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  const showFormation = Boolean(squad && squad.some((s) => s.player));
  const accentClub = clubColorOverride ?? clubs[0]?.club;
  const accentColors = accentClub ? getClubColors(accentClub) : undefined;

  return (
    <div className={SPACING.stackMd}>
      {clubs.length === 0 ? (
        <p className={TYPO.bodySm}>No players signed</p>
      ) : showFormation && squad ? (
        <FormationPanel
          squad={squad}
          clubColorOverride={clubColorOverride}
          eraTeamLabel={eraTeamLabel}
          accentColors={accentColors}
        />
      ) : (
        clubs.map((c) => {
          const isExpanded = expandedClub === c.club;
          const colors = getClubColors(clubColorOverride ?? c.club);
          return (
            <div key={c.club}>
              <RLClubRow
                club={c.club}
                count={c.count}
                totalValue={c.totalValue}
                expanded={isExpanded}
                onClick={() => toggleClub(c.club)}
              />
              <AnimatePresence initial={false}>
                {isExpanded && squad && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2">
                      <FormationPanel
                        squad={squad}
                        clubColorOverride={clubColorOverride ?? c.club}
                        accentColors={colors}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}

      {clubs.length > 0 && (
        <div
          className={`flex items-center justify-between ${CARD.base} px-4 py-3 ${TYPO.statValue} ${
            isValid
              ? "border-accent-green/35 bg-accent-green/10 text-accent-green"
              : "border-accent-red/35 bg-accent-red/10 text-accent-red"
          }`}
        >
          <span className={TYPO.sectionTitle}>Total Players</span>
          <span>
            {totalPlayers}
            {!isValid && ` / ${expectedPlayers} expected`}
          </span>
        </div>
      )}
    </div>
  );
}
