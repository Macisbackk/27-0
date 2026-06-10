"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { POSITION_LABELS } from "@/lib/positions";
import { playPanelExpand } from "@/lib/sound";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TryScorerClubBadge } from "./TryScorerClubBadge";

const RANK_STYLES = [
  "text-accent-gold",
  "text-gray-300",
  "text-amber-700/90",
] as const;

function formatScorerPosition(scorer: PlayerTryTotal): string {
  if (scorer.playedPosition && scorer.playedPosition !== scorer.position) {
    return `${POSITION_LABELS[scorer.position]} → ${POSITION_LABELS[scorer.playedPosition]}`;
  }
  return POSITION_LABELS[scorer.position];
}

interface TryScorersSectionProps {
  tryScorers: PlayerTryTotal[];
  expectedTotalTries: number;
}

export function TryScorersSection({
  tryScorers,
  expectedTotalTries,
}: TryScorersSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const topThree = tryScorers.slice(0, 3);
  const listedTotal = tryScorers.reduce((sum, s) => sum + s.tries, 0);

  if (tryScorers.length === 0) return null;

  return (
    <div className={`${CARD.base} ${SPACING.cardPaddingSm} text-left`}>
      <div className={SPACING.stackSm}>
        {topThree.map((scorer, index) => {
          const rankStyle = RANK_STYLES[index] ?? "text-gray-400";
          return (
            <div
              key={scorer.playerId}
              className={`${CARD.inset} px-3 py-2.5`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`w-7 shrink-0 font-display text-xl font-black leading-none sm:text-2xl ${rankStyle}`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${TYPO.playerNameSm}`}>
                    {scorer.name}
                  </p>
                  <div className="mt-1">
                    <TryScorerClubBadge club={scorer.club} />
                  </div>
                  <p className={`mt-1.5 ${TYPO.bodySm}`}>
                    {formatScorerPosition(scorer)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl font-black text-accent-gold sm:text-2xl">
                    {scorer.tries}
                  </p>
                  <p className={TYPO.statLabel}>
                    {scorer.tries === 1 ? "Try" : "Tries"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tryScorers.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => {
                if (!v) playPanelExpand();
                return !v;
              });
            }}
            className={`mt-3 w-full ${BTN.base} ${BTN.accentOutline} !min-h-[40px] text-[10px]`}
            aria-expanded={expanded}
          >
            {expanded ? "Collapse All" : "View All Try Scorers"}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`mt-2 ${SPACING.stackSm}`}>
                  {tryScorers.map((scorer, index) => (
                    <div
                      key={scorer.playerId}
                      className={`${CARD.inset} px-3 py-2.5`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 shrink-0 text-center ${TYPO.statLabel}`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate ${TYPO.statValue}`}>
                            {scorer.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <TryScorerClubBadge club={scorer.club} />
                            <span className={TYPO.bodySm}>
                              {formatScorerPosition(scorer)}
                            </span>
                          </div>
                        </div>
                        <span className={`shrink-0 ${TYPO.statValueLg} text-accent-gold`}>
                          {scorer.tries}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className={`mt-3 flex items-center justify-between ${CARD.inset} px-3 py-2 ${TYPO.statLabel}`}>
        <span>Total tries</span>
        <span className={`${TYPO.statValue} font-display`}>
          {listedTotal}
          {listedTotal !== expectedTotalTries && (
            <span className="ml-1 text-red-400">/ {expectedTotalTries}</span>
          )}
        </span>
      </div>
    </div>
  );
}
