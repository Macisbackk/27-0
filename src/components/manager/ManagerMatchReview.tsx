"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BracketRecap } from "@/components/BracketRecap";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { MatchPlayerOfTheMatchCard } from "@/components/MatchPlayerOfTheMatchCard";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerMatchEventLine } from "@/components/manager/ManagerMatchEventLine";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import { ManagerMobileBackBar, ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import {
  getManagerCupRoundLabel,
  isChallengeCupFixture,
  managerFixtureDisplayId,
  resolveManagerFixtureRecord,
} from "@/lib/manager/managerFixtureDisplay";
import {
  managerCompetitionSurfaceClass,
  managerCalloutClass,
  managerInsetPanelClass,
  managerResultBadgeClass,
} from "@/lib/manager/managerSurfaces";
import {
  cupRoundKeyToBracketRound,
  snapshotCupBracketAtRound,
} from "@/lib/manager/managerChallengeCup";
import {
  getManagerMatchKeyMoment,
  type MatchKeyMomentTone,
} from "@/lib/manager/managerMatchMoments";

function MatchReviewBackBar({
  onClose,
  placement = "top",
}: {
  onClose: () => void;
  placement?: "top" | "bottom";
}) {
  return (
    <ManagerMobileBackBar
      label="Back to hub"
      onBack={onClose}
      placement={placement}
    />
  );
}

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
  const [mobileTab, setMobileTab] = useState<"story" | "stats" | "tactics">(
    "story"
  );

  const fixture = resolveManagerFixtureRecord(career, fixtureId);

  if (!fixture) {
    return (
      <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
        <MatchReviewBackBar onClose={onClose} />
        <div className={`${CARD.elevated} ${SPACING.cardPaddingMobile} text-center space-y-4`}>
          <h1 className={TYPO.viewTitle}>Match not found</h1>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            This result could not be loaded from your save.
          </p>
        </div>
        <MatchReviewBackBar onClose={onClose} placement="bottom" />
      </div>
    );
  }

  const isLastMatch =
    career.lastMatchFixture != null &&
    managerFixtureDisplayId(career.lastMatchFixture) ===
      managerFixtureDisplayId(fixture);

  const squad = buildSquadSlotsFromMatchday(
    fixture.meta?.matchdayXiii ??
      (isLastMatch ? career.matchdayXiii : career.matchdayXiii.map(() => "")),
    fixture.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions,
    career
  );
  const attendance = fixture.meta?.attendance;
  const won = fixture.result === "W";
  const lost = fixture.result === "L";
  const resultBadgeClass = managerResultBadgeClass(
    won ? "win" : lost ? "loss" : "draw"
  );

  const roundLabel =
    fixture.competition === "challenge_cup"
      ? getManagerCupRoundLabel(fixture.meta?.cupRound)
      : fixture.competition === "playoffs"
        ? "Play-Offs"
        : fixture.competition === "friendly"
          ? "Friendly"
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

  const keyMoment = getManagerMatchKeyMoment(
    fixture,
    career.club,
    fixture.competition ?? fixture.meta?.competition
  );

  const momentToneClass: Record<MatchKeyMomentTone, string> = {
    gold: managerCalloutClass("gold"),
    primary: managerCalloutClass("primary"),
    red: managerCalloutClass("red"),
    sky: managerCalloutClass("sky"),
    muted: managerCalloutClass("muted"),
  };

  const hasTactics = Boolean(
    fixture.meta?.tacticReview ||
      fixture.meta?.tacticEffectivenessLine ||
      fixture.meta?.tacticImpactLine
  );

  const tabVisible = (tab: typeof mobileTab) =>
    mobileTab === tab ? "block space-y-4" : "hidden sm:block sm:space-y-4";

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <MatchReviewBackBar onClose={onClose} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className={TYPO.viewTitle}>Match Review</h1>
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

      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} text-center ${
          fixture.competition
            ? managerCompetitionSurfaceClass(fixture.competition)
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

      <div className="sm:hidden">
        <ManagerSubTabBar
          tabs={(
            [
              ["story", "Story"],
              ["stats", "Stats"],
              ...(hasTactics ? ([["tactics", "Tactics"]] as const) : []),
            ] as const
          ).map(([id, label]) => ({ id, label }))}
          active={mobileTab}
          onChange={setMobileTab}
          ariaLabel="Match review sections"
        />
      </div>

      <div className={tabVisible("story")}>
      {keyMoment && (
        <div
          className={`rounded-xl border px-4 py-3 ${momentToneClass[keyMoment.tone]}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider">
            {keyMoment.label}
          </p>
          <p className="mt-1 font-display text-lg font-bold text-white">
            {keyMoment.headline}
          </p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-200`}>{keyMoment.body}</p>
        </div>
      )}

      {fixture.matchBio && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Match Story</p>
          <p className={`mt-2 leading-relaxed whitespace-pre-line ${TYPO.bodySm} text-pitch-200`}>
            {fixture.matchBio}
          </p>
        </div>
      )}

      {cupBracketSnapshot && (
        <div className={managerInsetPanelClass("gold")}>
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

      {fixture.manOfTheMatch && (
        <MatchPlayerOfTheMatchCard
          motm={fixture.manOfTheMatch}
          userClub={career.club}
        />
      )}
      </div>

      <div className={tabVisible("stats")}>
      <AnimatePresence>
        <MatchDetailsPanel
          fixture={fixture}
          onClose={onClose}
          roundLabel={roundLabel}
          seed={career.seed}
          userSquad={squad}
          userTeamName={career.club}
          currentSeasonOnly
          hideMatchStory
          hideMotm
          scoringOnly
        />
      </AnimatePresence>

      {attendance && (
        <ManagerSectionCard
          title={
            attendance.excludedFromClubFunds
              ? `Grand Final · ${attendance.venue ?? "Neutral venue"}`
              : "Gate & Fans"
          }
          accent="sky"
        >
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <ManagerStat
              label="Attendance"
              value={attendance.attendance.toLocaleString()}
              tone="sky"
            />
            {attendance.excludedFromClubFunds ? (
              <ManagerStat
                label="Gate income"
                value="Neutral venue — no club gate"
                tone="gold"
              />
            ) : (
              <>
                <ManagerStat
                  label="Gate income"
                  value={formatWage(attendance.gateIncome)}
                  tone="gold"
                />
                <ManagerStat
                  label="→ Transfer fund"
                  value={formatWage(
                    attendance.transferAllocation ??
                      Math.round(attendance.gateIncome * 0.12)
                  )}
                  tone="gold"
                />
                <ManagerStat
                  label="→ Club operations"
                  value={formatWage(
                    attendance.operatingAllocation ??
                      attendance.gateIncome -
                        Math.round(attendance.gateIncome * 0.12)
                  )}
                  tone="primary"
                />
              </>
            )}
            <ManagerStat
              label="Fan Mood"
              value={`${attendance.fanMoodChange >= 0 ? "+" : ""}${attendance.fanMoodChange}`}
              tone={attendance.fanMoodChange >= 0 ? "primary" : "red"}
            />
          </div>
        </ManagerSectionCard>
      )}

      {fixture.meta?.liveEvents && fixture.meta.liveEvents.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Match Events</p>
          <ul className={`mt-2 max-h-48 overflow-y-auto ${SPACING.stackSm}`}>
            {[...fixture.meta.liveEvents].reverse().map((ev, i) => (
              <ManagerMatchEventLine
                key={`${ev.minute}-${i}`}
                event={ev}
                userClub={career.club}
                opponentClub={fixture.opponent}
              />
            ))}
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

      {hasTactics && (
        <div className={tabVisible("tactics")}>
      {(fixture.meta?.tacticReview ||
        fixture.meta?.tacticEffectivenessLine ||
        fixture.meta?.tacticImpactLine) && (
        <ManagerSectionCard title="Tactical Report" accent="primary">
          {fixture.meta.tacticReview ? (
            <>
              <p
                className={`mt-1 ${TYPO.bodySm} font-semibold ${
                  won ? "text-theme-primary" : "text-pitch-100"
                }`}
              >
                {fixture.meta.tacticReview.headline}
              </p>
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
                <span className="font-semibold text-pitch-500">You used: </span>
                {fixture.meta.tacticReview.usedLabel}
              </p>
              <ul className={`mt-3 ${SPACING.stackSm}`}>
                {fixture.meta.tacticReview.recommendations.map((line) => (
                  <li
                    key={line}
                    className={`flex gap-2 ${TYPO.bodySm} leading-relaxed text-pitch-200`}
                  >
                    <span className="shrink-0 text-theme-primary" aria-hidden>
                      →
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {fixture.meta.tacticImpactLine && (
                <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
                  <span className="font-semibold text-pitch-500">Game plan: </span>
                  {fixture.meta.tacticImpactLine}
                </p>
              )}
              {fixture.meta.tacticEffectivenessLine && (
                <p
                  className={`${fixture.meta.tacticImpactLine ? "mt-2" : "mt-1"} ${TYPO.bodySm} ${
                    won ? "text-theme-primary" : "text-pitch-200"
                  }`}
                >
                  <span className="font-semibold text-pitch-500">How it played: </span>
                  {fixture.meta.tacticEffectivenessLine}
                </p>
              )}
            </>
          )}
        </ManagerSectionCard>
      )}
        </div>
      )}

      <MatchReviewBackBar onClose={onClose} placement="bottom" />
    </div>
  );
}
