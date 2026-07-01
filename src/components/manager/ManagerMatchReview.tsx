"use client";

import { AnimatePresence } from "framer-motion";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { POSITION_SHORT } from "@/lib/positions";
import { getClubByName } from "@/lib/clubs";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  getManagerCupRoundLabel,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";
import { BracketRecap } from "@/components/BracketRecap";
import {
  cupRoundKeyToBracketRound,
  snapshotCupBracketAtRound,
} from "@/lib/manager/managerChallengeCup";

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
    fixture.meta?.matchdayXiii ?? career.matchdayXiii,
    fixture.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions,
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
  const interchangeIds =
    fixture.meta?.matchdayInterchange ?? career.matchdayInterchange;
  const benchPlayers = interchangeIds
    .filter(Boolean)
    .map((id) => getManagerPlayer(career, id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const roundLabel =
    fixture.competition === "challenge_cup"
      ? getManagerCupRoundLabel(fixture.meta?.cupRound)
      : fixture.competition === "playoffs"
        ? "Play-Offs"
        : `Round ${fixture.round} — League`;

  const cupBracketSnapshot =
    isChallengeCupFixture(fixture.competition) &&
    career.challengeCup &&
    fixture.meta?.cupRound
      ? snapshotCupBracketAtRound(
          career.challengeCup,
          cupRoundKeyToBracketRound(fixture.meta.cupRound)
        )
      : null;

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={TYPO.pageTitle}>Match Review</h1>
          {fixture.competition && (
            <ManagerCompetitionBadge
              competition={fixture.competition}
              cupRound={fixture.meta?.cupRound}
              detailed={isChallengeCupFixture(fixture.competition)}
            />
          )}
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

      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} text-center ${
          isChallengeCupFixture(fixture.competition)
            ? "border-2 border-accent-gold/50 bg-accent-gold/10 ring-1 ring-accent-gold/25"
            : ""
        }`}
      >
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

      {cupBracketSnapshot && (
        <div
          className={`${CARD.base} ${SPACING.cardPadding} border-2 border-accent-gold/40 bg-accent-gold/5`}
        >
          <p className={`${TYPO.sectionLabel} text-accent-gold`}>
            Challenge Cup Bracket · {roundLabel}
          </p>
          <p className={`mt-1 mb-3 ${TYPO.bodySm} text-pitch-400`}>
            Bracket as it stood after this tie
          </p>
          <BracketRecap
            matches={cupBracketSnapshot.matches}
            userClub={career.club}
            byeTeams={cupBracketSnapshot.byeTeams}
          />
        </div>
      )}

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

      {benchPlayers.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Interchange</p>
          <ul className={`mt-2 flex flex-wrap gap-2 ${TYPO.bodySm}`}>
            {benchPlayers.map((player) => {
              const tries =
                fixture.scoringDetail?.dreamTeam.tryScorers.find(
                  (s) => s.playerId === player.id
                )?.tries ?? 0;
              return (
                <li
                  key={player.id}
                  className="rounded-lg border border-pitch-600 bg-pitch-900/50 px-2 py-1"
                >
                  {player.name}
                  <span className="text-pitch-500">
                    {" "}
                    · {POSITION_SHORT[player.position]}
                    {tries > 0 ? ` · ${tries} try${tries === 1 ? "" : "ies"}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
