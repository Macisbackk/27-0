"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { formatTryScorerPosition } from "@/lib/player-season-review";
import type { SquadSlot } from "@/lib/types";
import { playPanelExpand } from "@/lib/sound";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TryScorerClubBadge } from "./TryScorerClubBadge";

const RANK_STYLES = [
  "text-accent-gold",
  "text-gray-300",
  "text-amber-700/90",
] as const;

interface TryScorersSectionProps {
  tryScorers: PlayerTryTotal[];
  expectedTotalTries: number;
  squad?: SquadSlot[];
  compact?: boolean;
}

function ScorerCard({
  scorer,
  index,
  squad,
  featured,
}: {
  scorer: PlayerTryTotal;
  index: number;
  squad?: SquadSlot[];
  featured?: boolean;
}) {
  const rankStyle = featured
    ? (RANK_STYLES[index] ?? "text-gray-400")
    : "text-pitch-500";

  return (
    <div className={`${CARD.inset} px-3 py-3 text-center`}>
      <p
        className={`font-display font-black leading-none ${
          featured ? "text-xl sm:text-2xl" : `text-sm ${TYPO.statLabel}`
        } ${rankStyle}`}
      >
        {featured ? index + 1 : `#${index + 1}`}
      </p>
      <p className={`mt-2 break-words ${featured ? TYPO.playerNameSm : TYPO.statValue}`}>
        {scorer.name}
      </p>
      <div className="mt-1.5 flex justify-center">
        <TryScorerClubBadge club={scorer.club} />
      </div>
      <p className={`mt-1.5 ${TYPO.bodySm}`}>
        {formatTryScorerPosition(scorer, squad)}
      </p>
      <p
        className={`mt-2 font-display font-black text-accent-gold ${
          featured ? "text-xl sm:text-2xl" : "text-lg"
        }`}
      >
        {scorer.tries}
      </p>
      <p className={TYPO.statLabel}>
        {scorer.tries === 1 ? "Try" : "Tries"}
      </p>
    </div>
  );
}

export function TryScorersSection({
  tryScorers,
  expectedTotalTries,
  squad,
  compact = false,
}: TryScorersSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const topThree = tryScorers.slice(0, 3);
  const listedTotal = tryScorers.reduce((sum, s) => sum + s.tries, 0);

  if (tryScorers.length === 0) return null;

  return (
    <div
      className={`${compact ? "" : `${CARD.base} ${SPACING.cardPaddingSm}`} text-center`}
    >
      <div className={SPACING.stackSm}>
        {topThree.map((scorer, index) => (
          <ScorerCard
            key={scorer.playerId}
            scorer={scorer}
            index={index}
            squad={squad}
            featured
          />
        ))}
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
                    <ScorerCard
                      key={scorer.playerId}
                      scorer={scorer}
                      index={index}
                      squad={squad}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {!compact && (
        <div
          className={`mt-3 ${CARD.inset} px-3 py-2 text-center ${TYPO.statLabel}`}
        >
          <span>Total tries</span>
          <span className={`ml-2 ${TYPO.statValue} font-display`}>
            {listedTotal}
            {listedTotal !== expectedTotalTries && (
              <span className="ml-1 text-red-400">/ {expectedTotalTries}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
