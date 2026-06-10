"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";

function formatScorerPosition(scorer: PlayerTryTotal): string {
  if (scorer.playedPosition && scorer.playedPosition !== scorer.position) {
    return `${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`;
  }
  return POSITION_LABELS[scorer.position];
}

interface TryScorersPanelProps {
  tryScorers: PlayerTryTotal[];
  expectedTotalTries: number;
  title?: string;
}

export function TryScorersPanel({
  tryScorers,
  expectedTotalTries,
  title = "View All Try Scorers",
}: TryScorersPanelProps) {
  const [open, setOpen] = useState(false);
  const listedTotal = tryScorers.reduce((sum, s) => sum + s.tries, 0);

  if (tryScorers.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg border border-pitch-600/50 bg-pitch-950/60 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wider text-accent-green transition hover:border-accent-green/40 hover:bg-pitch-900/80 hover:text-emerald-300"
        aria-expanded={open}
      >
        {open ? "Hide All Try Scorers" : title}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {tryScorers.map((scorer, index) => {
                const colors = getClubColors(scorer.club);
                return (
                  <div
                    key={scorer.playerId}
                    className="flex items-center gap-3 rounded-lg border border-pitch-700/40 bg-pitch-950/60 px-3 py-2.5"
                    style={{ borderLeftWidth: "3px", borderLeftColor: colors.primary }}
                  >
                    <span className="w-6 shrink-0 text-center font-display text-xs font-bold text-gray-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {scorer.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        <span style={{ color: colors.primary }}>{scorer.club}</span>
                        <span className="mx-1.5 text-pitch-600">·</span>
                        {formatScorerPosition(scorer)}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-accent-gold">
                      {scorer.tries}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between rounded-lg border border-pitch-700/30 bg-pitch-900/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <span>Total tries</span>
                <span className="font-display text-sm text-white">
                  {listedTotal}
                  {listedTotal !== expectedTotalTries && (
                    <span className="ml-1 text-red-400">
                      / {expectedTotalTries}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
