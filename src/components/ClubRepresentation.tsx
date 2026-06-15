"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ClubBreakdownSummary,
  ClubPlayerDisplayCategory,
  ClubPlayerEntry,
} from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
import { RLClubRow } from "./cards/RLClubRow";
import {
  PlayerSpecialBadge,
  PlayerStatusBadge,
  type PlayerStatusType,
} from "./cards/PlayerStatusBadge";
import { playPanelExpand } from "@/lib/sound";
import { formatValue, formatPlayerAgeLabel, getPlayerById } from "@/lib/players";
import { formatPositionReviewText } from "@/lib/squad-display";
import { buildTeamSheetLineup } from "@/lib/club-lineup";
import { getFormationSlotDisplayLabel } from "@/lib/positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubPillBackground } from "@/lib/ui/contrast";

function formatRatingLine(player: {
  ratingAdjusted: boolean;
  originalRating: number;
  adjustedRating: number;
}): string {
  if (player.ratingAdjusted) {
    return `${player.originalRating} → ${player.adjustedRating} OVR`;
  }
  return `${player.adjustedRating} OVR`;
}

interface ClubRepresentationProps {
  summary: ClubBreakdownSummary;
  /** Era mode: apply era team colours to all club rows. */
  clubColorOverride?: string;
}

function ClubPlayerStatusBadge({
  category,
}: {
  category: ClubPlayerDisplayCategory;
}) {
  if (category === "goat") {
    return <PlayerSpecialBadge variant="goat" />;
  }
  if (category === "superSam") {
    return <PlayerSpecialBadge variant="superSam" />;
  }
  return <PlayerStatusBadge status={category as PlayerStatusType} />;
}

function TeamSheetPlayerRow({
  positionLabel,
  player,
  clubName,
  accentPrimary,
}: {
  positionLabel: string;
  player: ClubPlayerEntry;
  clubName: string;
  accentPrimary: string;
}) {
  const poolPlayer = getPlayerById(player.playerId);
  const positionNote =
    player.playerId === "ssh-sam-hallas-group"
      ? "All 13 positions"
      : formatPositionReviewText(player);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-pitch-600/45 bg-pitch-900/55 px-2 py-1.5 sm:gap-3 sm:px-2.5 sm:py-2`}
      style={{ borderLeftColor: `${accentPrimary}88`, borderLeftWidth: 3 }}
    >
      <div className="w-[4.5rem] shrink-0 sm:w-[5.5rem]">
        <p className="font-display text-[9px] font-bold uppercase leading-tight tracking-wide text-gray-500 sm:text-[10px]">
          {positionLabel}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`truncate ${TYPO.playerNameSm}`}>{player.name}</p>
          <ClubPlayerStatusBadge category={player.displayCategory} />
        </div>
        {player.positionMismatch && (
          <p className={`mt-0.5 ${TYPO.bodySm} text-amber-400/90`}>
            {positionNote}
          </p>
        )}
        {player.displayClub && player.displayClub !== clubName && (
          <p className={`mt-0.5 ${TYPO.bodySm} text-accent-gold/90`}>
            {player.displayClub}
          </p>
        )}
        {poolPlayer && !player.positionMismatch && (
          <p className={`mt-0.5 hidden ${TYPO.bodySm} text-gray-500 sm:block`}>
            {formatPlayerAgeLabel(poolPlayer)}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`${TYPO.rating} text-xs sm:text-sm`}>
          {formatRatingLine(player)}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold text-accent-gold sm:text-xs">
          {formatValue(player.value)}
        </p>
      </div>
    </div>
  );
}

export function ClubRepresentation({
  summary,
  clubColorOverride,
}: ClubRepresentationProps) {
  const { clubs, totalPlayers, expectedPlayers, isValid } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(null);

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  return (
    <div className={SPACING.stackMd}>
      {clubs.length === 0 ? (
        <p className={TYPO.bodySm}>No players signed</p>
      ) : (
        clubs.map((c) => {
          const isExpanded = expandedClub === c.club;
          const colors = getClubColors(clubColorOverride ?? c.club);
          const lineupRows = buildTeamSheetLineup(c.players);
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
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`mt-2 ${CARD.base} ${SPACING.cardPaddingSm}`}
                      style={{
                        borderColor: `${getClubPillBackground(colors.primary, colors.secondary, colors.accent)}55`,
                        background: `linear-gradient(135deg, ${colors.primary}18 0%, rgba(15,23,42,0.9) 55%)`,
                      }}
                    >
                      <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                        Team Sheet
                      </p>
                      <div className="grid gap-1 sm:gap-1.5">
                        {lineupRows.map((row) => (
                          <TeamSheetPlayerRow
                            key={row.player.playerId}
                            positionLabel={
                              row.positionLabel ||
                              getFormationSlotDisplayLabel(row.player.slotIndex)
                            }
                            player={row.player}
                            clubName={c.club}
                            accentPrimary={colors.primary}
                          />
                        ))}
                      </div>
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
