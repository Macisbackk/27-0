"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ClubBreakdownSummary,
  ClubPlayerDisplayCategory,
} from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
import { RLClubRow } from "./cards/RLClubRow";
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

const DISPLAY_CLASS: Record<ClubPlayerDisplayCategory, string> = {
  current: "border-accent-green/40 bg-accent-green/15 text-accent-green",
  historic: "border-purple-400/35 bg-purple-500/12 text-purple-200",
  legend: "border-accent-gold/40 bg-accent-gold/12 text-accent-gold",
  goat: "border-accent-gold/55 bg-accent-gold/20 text-accent-gold",
};

export function ClubRepresentation({ summary }: ClubRepresentationProps) {
  const { clubs, totalPlayers, expectedPlayers, isValid } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(null);

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => (prev === club ? null : club));
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
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white">
                                {player.name}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {formatPositionLine(player)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DISPLAY_CLASS[player.displayCategory]}`}
                            >
                              {DISPLAY_LABEL[player.displayCategory]}
                            </span>
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
