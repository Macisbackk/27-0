"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ClubBreakdownSummary,
  ClubPlayerDisplayCategory,
} from "@/lib/squad-analysis";
import { RLClubRow } from "./cards/RLClubRow";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
import { formatValue } from "@/lib/players";
import { POSITION_LABELS } from "@/lib/positions";

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
  current: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  historic: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  legend: "border-accent-gold/35 bg-accent-gold/10 text-accent-gold",
  goat: "border-accent-gold/50 bg-accent-gold/20 text-accent-gold",
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
                      className={`mt-2 space-y-2.5 border-l-2 border-accent-green/30 pl-4 ${RL_INFO_BOX_CLASS} py-3`}
                    >
                      {c.players.map((player) => (
                        <li
                          key={player.playerId}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-white">
                            {player.name}{" "}
                            <span className="font-normal text-gray-400">
                              ({DISPLAY_LABEL[player.displayCategory]}) —{" "}
                              {player.peakRating} OVR — {formatValue(player.value)}
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2 sm:hidden">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DISPLAY_CLASS[player.displayCategory]}`}
                            >
                              {DISPLAY_LABEL[player.displayCategory]}
                            </span>
                          </div>
                          <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">
                            {POSITION_LABELS[player.position]}
                          </span>
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
          className={`flex items-center justify-between px-3 py-2.5 text-sm font-bold ${RL_INFO_BOX_CLASS} ${
            isValid ? "text-accent-green" : "text-red-400"
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
