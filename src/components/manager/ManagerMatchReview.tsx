"use client";

import { AnimatePresence } from "framer-motion";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { getClubByName } from "@/lib/clubs";

interface ManagerMatchReviewProps {
  career: ManagerCareer;
  round: number;
  onClose: () => void;
}

export function ManagerMatchReview({
  career,
  round,
  onClose,
}: ManagerMatchReviewProps) {
  const fixture = career.fixtures.find((f) => f.round === round);
  if (!fixture) return null;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions
  );
  const club = getClubByName(career.club);

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className={TYPO.pageTitle}>Match Review</h1>
        <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onClose}>
          Close
        </GameButton>
      </div>

      {fixture.meta?.tacticImpactLine && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={`${TYPO.bodySm} italic text-pitch-300`}>
            {fixture.meta.tacticImpactLine}
          </p>
        </div>
      )}

      <AnimatePresence>
        <MatchDetailsPanel
          fixture={fixture}
          onClose={onClose}
          roundLabel={`Round ${round}`}
          seed={career.seed}
          userSquad={squad}
          userTeamName={career.club}
          userClubColorOverride={club?.primaryColor}
          currentSeasonOnly
        />
      </AnimatePresence>

      {fixture.meta?.injuries && fixture.meta.injuries.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Injuries</p>
          <ul className={`mt-2 ${SPACING.stackSm}`}>
            {fixture.meta.injuries.map((inj) => (
              <li key={inj.playerId} className={`${TYPO.bodySm} text-red-300`}>
                {inj.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
