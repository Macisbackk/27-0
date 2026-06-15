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
import { buildClubLineupGroups } from "@/lib/club-lineup";
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

function LineupPlayerRow({
  player,
  clubName,
}: {
  player: ClubPlayerEntry;
  clubName: string;
}) {
  const poolPlayer = getPlayerById(player.playerId);

  return (
    <div className={`${CARD.inset} px-2.5 py-2 sm:px-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={TYPO.playerNameSm}>{player.name}</p>
          <ClubPlayerStatusBadge category={player.displayCategory} />
          <p className={`mt-0.5 ${TYPO.bodySm} text-gray-400`}>
            {player.playerId === "ssh-sam-hallas-group"
              ? "All 13 positions"
              : formatPositionReviewText(player)}
            {poolPlayer && (
              <>
                <span className="mx-1.5 text-gray-600">·</span>
                <span>{formatPlayerAgeLabel(poolPlayer)}</span>
              </>
            )}
          </p>
          {player.displayClub && player.displayClub !== clubName && (
            <p className={`mt-0.5 ${TYPO.bodySm} text-accent-gold/90`}>
              {player.displayClub}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`${TYPO.rating} text-sm`}>{formatRatingLine(player)}</p>
          <p className="mt-0.5 text-xs font-semibold text-accent-gold">
            {formatValue(player.value)}
          </p>
        </div>
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
          const lineupGroups = buildClubLineupGroups(c.players);
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
                      <div className={SPACING.stackSm}>
                        {lineupGroups.map((group) => (
                          <section key={group.label}>
                            <p
                              className={`mb-1.5 border-b border-white/10 pb-1 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500`}
                            >
                              {group.label}
                            </p>
                            <div className="grid gap-1.5">
                              {group.rows.map((row) => (
                                <div key={`${row.positionLabel}-${row.players[0]?.playerId}`}>
                                  <p className="mb-0.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    {row.positionLabel}
                                  </p>
                                  {row.players.map((player) => (
                                    <LineupPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      clubName={c.club}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                          </section>
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
