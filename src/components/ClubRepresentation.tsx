"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ClubBreakdownSummary,
  ClubPlayerDisplayCategory,
} from "@/lib/squad-analysis";
import type { BracketTeamTournamentStats } from "@/lib/game/challenge-cup-stats";
import type { EraTournamentClubGroup } from "@/lib/players/era-teams";
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
  /** Era mode: tournament teams grouped by underlying club. */
  eraTournamentGroups?: EraTournamentClubGroup[];
  bracketTeamStats?: Map<string, BracketTeamTournamentStats>;
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

export function ClubRepresentation({
  summary,
  clubColorOverride,
  eraTournamentGroups,
  bracketTeamStats,
}: ClubRepresentationProps) {
  const { clubs, totalPlayers, expectedPlayers, isValid } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [expandedTournamentClub, setExpandedTournamentClub] = useState<
    string | null
  >(null);

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  const toggleTournamentClub = (club: string) => {
    setExpandedTournamentClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  const formatTournamentRecord = (teamName: string) => {
    const stats = bracketTeamStats?.get(teamName);
    if (!stats) return "—";
    const games = stats.wins + stats.losses;
    if (games === 0) return "—";
    return `${stats.wins}-${stats.losses} · ${stats.pointsFor} PF · ${stats.triesFor} tries`;
  };

  return (
    <div className={SPACING.stackMd}>
      {eraTournamentGroups && eraTournamentGroups.length > 0 && (
        <div className={SPACING.stackSm}>
          <p className={TYPO.sectionLabel}>Tournament Teams</p>
          {eraTournamentGroups.map((group) => {
            const isExpanded = expandedTournamentClub === group.club;
            const colors = getClubColors(group.club);
            return (
              <div key={`tournament-${group.club}`}>
                <RLClubRow
                  club={group.club}
                  count={group.teams.length}
                  totalValue={0}
                  expanded={isExpanded}
                  onClick={() => toggleTournamentClub(group.club)}
                  hideValue
                />
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`mt-2 ${SPACING.stackSm} ${CARD.base} ${SPACING.cardPaddingSm}`}
                        style={{
                          borderColor: `${getClubPillBackground(colors.primary, colors.secondary, colors.accent)}55`,
                          background: `linear-gradient(135deg, ${colors.primary}18 0%, rgba(15,23,42,0.9) 55%)`,
                        }}
                      >
                        {group.teams.map((team) => (
                          <li
                            key={team.displayName}
                            className={`${CARD.inset} px-3 py-2.5`}
                          >
                            <p className={TYPO.playerNameSm}>{team.displayName}</p>
                            <p className={`mt-0.5 ${TYPO.bodySm}`}>
                              {formatTournamentRecord(team.displayName)}
                            </p>
                          </li>
                        ))}
                      </div>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {clubs.length === 0 ? (
        <p className={TYPO.bodySm}>No players signed</p>
      ) : (
        clubs.map((c) => {
          const isExpanded = expandedClub === c.club;
          const colors = getClubColors(clubColorOverride ?? c.club);
          return (
            <div key={c.club}>
              <RLClubRow
                club={clubColorOverride ?? c.club}
                count={c.count}
                totalValue={c.totalValue}
                expanded={isExpanded}
                onClick={() => toggleClub(c.club)}
              />
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`mt-2 ${SPACING.stackSm} ${CARD.base} ${SPACING.cardPaddingSm}`}
                      style={{
                        borderColor: `${getClubPillBackground(colors.primary, colors.secondary, colors.accent)}55`,
                        background: `linear-gradient(135deg, ${colors.primary}18 0%, rgba(15,23,42,0.9) 55%)`,
                      }}
                    >
                      {c.players.map((player) => {
                        const poolPlayer = getPlayerById(player.playerId);
                        return (
                        <li
                          key={player.playerId}
                          className={`${CARD.inset} px-3 py-2.5`}
                        >
                          <div className="min-w-0">
                            <p className={TYPO.playerNameSm}>
                              {player.name}
                            </p>
                            <ClubPlayerStatusBadge
                              category={player.displayCategory}
                            />
                            <p className={`mt-0 ${TYPO.bodySm}`}>
                              {player.playerId === "ssh-sam-hallas-group"
                                ? "All 13 positions"
                                : formatPositionReviewText(player)}
                              {poolPlayer && (
                                <>
                                  <span className="mx-2 text-gray-600">·</span>
                                  <span>{formatPlayerAgeLabel(poolPlayer)}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className={`mt-2 flex flex-wrap items-center gap-3 ${TYPO.bodySm}`}>
                            <span className={`${TYPO.rating} text-sm`}>
                              {formatRatingLine(player)}
                            </span>
                            <span className="text-gray-500">·</span>
                            <span className="font-semibold text-accent-gold">
                              {formatValue(player.value)}
                            </span>
                          </div>
                        </li>
                        );
                      })}
                    </div>
                  </motion.ul>
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
          <span className={TYPO.sectionTitle}>
            Total Players
          </span>
          <span>
            {totalPlayers}
            {!isValid && ` / ${expectedPlayers} expected`}
          </span>
        </div>
      )}
    </div>
  );
}
