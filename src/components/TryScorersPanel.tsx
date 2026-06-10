"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { POSITION_LABELS } from "@/lib/positions";

function formatScorerPosition(scorer: PlayerTryTotal): string {
  if (
    scorer.playedPosition &&
    scorer.playedPosition !== scorer.position
  ) {
    return `${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`;
  }
  return POSITION_LABELS[scorer.position];
}
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";

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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-green transition hover:text-emerald-300"
        aria-expanded={open}
      >
        {open ? "Hide Try Scorers" : title}
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
            <div className={`${RL_INFO_BOX_CLASS} mt-3 overflow-x-auto p-3`}>
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-pitch-600/40 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="pb-2 pr-3">Player</th>
                    <th className="pb-2 pr-3">Position</th>
                    <th className="pb-2 pr-3">Club</th>
                    <th className="pb-2 text-right">Tries</th>
                  </tr>
                </thead>
                <tbody>
                  {tryScorers.map((scorer) => (
                    <tr
                      key={scorer.playerId}
                      className="border-b border-pitch-700/30 last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium text-white">
                        {scorer.name}
                      </td>
                      <td className="py-2 pr-3 text-gray-400">
                        {formatScorerPosition(scorer)}
                      </td>
                      <td className="py-2 pr-3 text-gray-400">{scorer.club}</td>
                      <td className="py-2 text-right font-display font-bold text-accent-gold">
                        {scorer.tries}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={3}
                      className="pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                    >
                      Total tries
                    </td>
                    <td className="pt-3 text-right font-display font-bold text-white">
                      {listedTotal}
                      {listedTotal !== expectedTotalTries && (
                        <span className="ml-1 text-red-400">
                          / {expectedTotalTries}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
