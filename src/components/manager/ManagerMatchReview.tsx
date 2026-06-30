"use client";

import { AnimatePresence } from "framer-motion";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { getClubByName } from "@/lib/clubs";
import { formatWage } from "@/lib/manager/managerContracts";

interface ManagerMatchReviewProps {
  career: ManagerCareer;
  fixtureId: string;
  onClose: () => void;
}

export function ManagerMatchReview({
  career,
  fixtureId,
  onClose,
}: ManagerMatchReviewProps) {
  const fixture =
    career.fixtures.find((f) => f.fixtureId === fixtureId) ??
    career.fixtures.find((f) => `round-${f.round}` === fixtureId);
  if (!fixture) return null;

  const squad = buildSquadSlotsFromMatchday(
    career.matchdayXiii,
    career.xiiiSlotPositions,
    career
  );
  const club = getClubByName(career.club);
  const attendance = fixture.meta?.attendance;
  const won = fixture.result === "W";
  const lost = fixture.result === "L";
  const resultBadgeClass = won
    ? "bg-theme-primary/20 text-theme-primary border-theme-primary/40"
    : lost
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : "bg-pitch-700/50 text-pitch-200 border-pitch-600";
  const roundLabel =
    fixture.competition === "challenge_cup"
      ? fixture.meta?.cupRound?.replace(/_/g, " ") ?? "Challenge Cup"
      : `Round ${fixture.round} — League`;

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={TYPO.pageTitle}>Match Review</h1>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${resultBadgeClass}`}
          >
            {won ? "Win" : lost ? "Loss" : "Draw"}
          </span>
        </div>
        <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onClose}>
          Close
        </GameButton>
      </div>

      <div className={`${CARD.elevated} ${SPACING.cardPadding} text-center`}>
        <p className={`text-xl font-bold text-white sm:text-2xl`}>
          <span className={fixture.isHome ? "text-theme-primary" : ""}>
            {fixture.isHome ? career.club : fixture.opponent}
          </span>{" "}
          <span className="text-theme-primary">{fixture.isHome ? fixture.pointsFor : fixture.pointsAgainst}</span>
          <span className="mx-2 text-pitch-500">-</span>
          <span className="text-theme-primary">{fixture.isHome ? fixture.pointsAgainst : fixture.pointsFor}</span>{" "}
          <span className={!fixture.isHome ? "text-theme-primary" : ""}>
            {!fixture.isHome ? career.club : fixture.opponent}
          </span>
        </p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{roundLabel}</p>
      </div>

      {attendance && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Gate & Fans</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <span>Attendance: {attendance.attendance.toLocaleString()}</span>
            <span>Gate Income: {formatWage(attendance.gateIncome)}</span>
            <span>
              Fan Mood: {attendance.fanMoodChange >= 0 ? "+" : ""}
              {attendance.fanMoodChange}
            </span>
          </div>
        </div>
      )}

      {fixture.meta?.liveEvents && fixture.meta.liveEvents.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Match Events</p>
          <ul className={`mt-2 max-h-48 overflow-y-auto ${SPACING.stackSm}`}>
            {[...fixture.meta.liveEvents].reverse().map((ev, i) => (
              <li key={`${ev.minute}-${i}`} className={`${TYPO.bodySm}`}>
                {ev.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {fixture.meta?.tacticEffectivenessLine && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={`${TYPO.bodySm} italic text-pitch-300`}>
            {fixture.meta.tacticEffectivenessLine}
          </p>
        </div>
      )}

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
          roundLabel={roundLabel}
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
