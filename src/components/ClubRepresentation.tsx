"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ClubBreakdownSummary,
  ClubPlayerDisplayCategory,
} from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
import { RLClubRow } from "./cards/RLClubRow";
import { RLTag } from "./cards/rl-card";
import { playPanelExpand } from "@/lib/sound";
import { formatValue } from "@/lib/players";
import type { Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";

function formatPositionLine(player: {
  positionMismatch: boolean;
  naturalPosition: Position;
  playedPosition: Position;
}): string {
  if (player.positionMismatch) {
    return `${POSITION_LABELS[player.naturalPosition]} → ${POSITION_LABELS[player.playedPosition]}`;
  }
  return POSITION_LABELS[player.playedPosition];
}

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
}

const DISPLAY_LABEL: Record<ClubPlayerDisplayCategory, string> = {
  current: "Current",
  historic: "Historic",
  legend: "Legend",
  goat: "GOAT",
};

const DISPLAY_VARIANT: Record<
  ClubPlayerDisplayCategory,
  "current" | "historic" | "legend" | "goat"
> = {
  current: "current",
  historic: "historic",
  legend: "legend",
  goat: "goat",
};

export function ClubRepresentation({ summary }: ClubRepresentationProps) {
  const { clubs, totalPlayers, expectedPlayers, isValid } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(null);

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  return (
    <div className="space-y-3">
      {clubs.length === 0 ? (
        <p className="text-sm text-gray-500">No players signed</p>
      ) : (
        clubs.map((c) => {
          const isExpanded = expandedClub === c.club;
          const colors = getClubColors(c.club);
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
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      className="mt-2 space-y-2 rounded-xl border px-3 py-3 sm:px-4"
                      style={{
                        borderColor: `${colors.primary}55`,
                        background: `linear-gradient(135deg, ${colors.primary}18 0%, rgba(15,23,42,0.85) 55%)`,
                      }}
                    >
                      {c.players.map((player) => (
                        <li
                          key={player.playerId}
                          className="rounded-lg border border-pitch-700/50 bg-pitch-950/70 px-3 py-2.5"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white">
                                {player.name}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {formatPositionLine(player)}
                              </p>
                            </div>
                            <RLTag
                              variant={DISPLAY_VARIANT[player.displayCategory]}
                            >
                              {DISPLAY_LABEL[player.displayCategory]}
                            </RLTag>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-display font-bold text-accent-green">
                              {formatRatingLine(player)}
                            </span>
                            <span className="text-gray-500">·</span>
                            <span className="font-semibold text-accent-gold">
                              {formatValue(player.value)}
                            </span>
                          </div>
                        </li>
                      ))}
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
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
            isValid
              ? "border-accent-green/35 bg-accent-green/10 text-accent-green"
              : "border-red-500/35 bg-red-500/10 text-red-400"
          }`}
        >
          <span className="font-display text-xs uppercase tracking-wider">
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
