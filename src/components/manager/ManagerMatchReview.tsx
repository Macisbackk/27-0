"use client";

import { useState } from "react";
import { BracketRecap } from "@/components/BracketRecap";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { MatchPlayerOfTheMatchCard } from "@/components/MatchPlayerOfTheMatchCard";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerMatchEventLine } from "@/components/manager/ManagerMatchEventLine";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  ManagerMobileBackBar,
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import {
  getManagerCupRoundLabel,
  isChallengeCupFixture,
  managerFixtureDisplayId,
  resolveManagerFixtureRecord,
} from "@/lib/manager/managerFixtureDisplay";
import { ensureManagerFixtureScoring } from "@/lib/manager/managerFixtureScoring";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import {
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
}: {
  onClose: () => void;
}) {
  return (
    <ManagerMobileBackBar
      label="Back to hub"
      onBack={onClose}
      placement="top"
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
      <ManagerPage>
        <ManagerSection>
          <div className={SPACING.stackLg}>
            <MatchReviewBackBar onClose={onClose} />
            <div className={`${CARD.elevated} ${SPACING.cardPaddingMobile} text-center space-y-4`}>
              <h1 className={TYPO.viewTitle}>Match not found</h1>
              <p className={`${TYPO.bodySm} text-pitch-400`}>
                This result could not be loaded from your save.
              </p>
            </div>
            <MatchReviewBackBar onClose={onClose} />
          </div>
        </ManagerSection>
      </ManagerPage>
    );
  }

  const squad = buildSquadSlotsFromMatchday(
    fixture.meta?.matchdayXiii ?? career.matchdayXiii,
    fixture.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions,
    career
  );
  // Repair missing / mismatched try scorers so Match Review scoring always shows names.
  ensureManagerFixtureScoring(
    career,
    fixture,
    squad,
    managerFixtureDisplayId(fixture)
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
  const hasStoryExtras = Boolean(keyMoment || cupBracketSnapshot);
  const effectiveMobileTab: typeof mobileTab =
    !hasStoryExtras && mobileTab === "story" ? "stats" : mobileTab;

  const tabVisible = (tab: typeof mobileTab) =>
    effectiveMobileTab === tab
      ? "block space-y-4"
      : "hidden sm:block sm:space-y-4";

  const matchOccasion = fixture.competition
    ? getManagerMatchOccasionPresentation({
        competition: fixture.competition,
        cupRound: fixture.meta?.cupRound,
        isNeutral: fixture.isNeutral,
        venue: fixture.meta?.attendance?.venue,
        round: fixture.round,
      })
    : null;

  return (
    <ManagerPage>
      <ManagerSection>
      <div className={SPACING.stackLg}>
      <MatchReviewBackBar onClose={onClose} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className={TYPO.viewTitle}>Match Review</h1>
        {fixture.competition && (
          <ManagerCompetitionBadge
            competition={fixture.competition}
            cupRound={fixture.meta?.cupRound}
            isNeutral={fixture.isNeutral}
            venue={fixture.meta?.attendance?.venue}
            detailed
          />
        )}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${resultBadgeClass}`}
        >
          {won ? "Win" : lost ? "Loss" : "Draw"}
        </span>
      </div>

      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} matchday-scoreboard ${
          matchOccasion
            ? `${matchOccasion.surfaceClass} ${matchOccasion.matchdayModifier}`
            : ""
        }`.trim()}
      >
        <div className="text-center">
          {matchOccasion?.momentLine ? (
            <p
              className={`mb-2 text-xs font-semibold uppercase tracking-wider ${matchOccasion.momentTextClass}`}
            >
              {matchOccasion.momentLine}
            </p>
          ) : matchOccasion?.weekLabel ? (
            <p
              className={`mb-2 text-xs font-semibold uppercase tracking-wider ${matchOccasion.momentTextClass}`}
            >
              {matchOccasion.weekLabel}
            </p>
          ) : null}
          {(() => {
            const homeName = fixture.isHome ? career.club : fixture.opponent;
            const awayName = !fixture.isHome ? career.club : fixture.opponent;
            const homePts = fixture.isHome
              ? fixture.pointsFor
              : fixture.pointsAgainst;
            const awayPts = fixture.isHome
              ? fixture.pointsAgainst
              : fixture.pointsFor;
            return (
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 uppercase tracking-wide leading-tight text-white">
                <span
                  className={`min-w-0 truncate text-right font-[family-name:var(--font-pitch)] text-[length:var(--text-body)] sm:text-[length:var(--text-section-header)] ${fixture.isHome ? "text-theme-primary" : ""}`}
                  title={homeName}
                >
                  {homeName}
                </span>
                <span className="shrink-0 text-center font-display text-2xl font-black tabular-nums text-theme-primary sm:text-3xl">
                  {homePts}-{awayPts}
                </span>
                <span
                  className={`min-w-0 truncate text-left font-[family-name:var(--font-pitch)] text-[length:var(--text-body)] sm:text-[length:var(--text-section-header)] ${!fixture.isHome ? "text-theme-primary" : ""}`}
                  title={awayName}
                >
                  {awayName}
                </span>
              </div>
            );
          })()}
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{roundLabel}</p>
        </div>

        {fixture.matchBio ? (
          <div className="mt-4 border-t border-pitch-700/45 pt-3 text-left">
            <p className={TYPO.sectionLabel}>Match Story</p>
            <p
              className={`mt-2 leading-relaxed whitespace-pre-line ${TYPO.bodySm} text-pitch-200`}
            >
              {fixture.matchBio}
            </p>
          </div>
        ) : null}

        {fixture.manOfTheMatch ? (
          <div className="mt-3 text-left">
            <MatchPlayerOfTheMatchCard
              motm={fixture.manOfTheMatch}
              userClub={career.club}
              className="border-pitch-700/50 bg-pitch-950/40 shadow-none"
            />
          </div>
        ) : null}
      </div>

      <div className="flex justify-center sm:hidden">
        <ManagerSubTabBar
          tabs={(
            [
              ...(hasStoryExtras ? ([["story", "Story"]] as const) : []),
              ["stats", "Stats"],
              ...(hasTactics ? ([["tactics", "Tactics"]] as const) : []),
            ] as const
          ).map(([id, label]) => ({ id, label }))}
          active={effectiveMobileTab}
          onChange={setMobileTab}
          ariaLabel="Match review sections"
        />
      </div>

      {hasStoryExtras ? (
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
            expandedMeta={
              "expandedMeta" in cupBracketSnapshot
                ? (cupBracketSnapshot as { expandedMeta?: import("@/lib/manager/championship/championshipChallengeCup").ExpandedCupMeta }).expandedMeta
                : undefined
            }
          />
        </div>
      )}
      </div>
      ) : null}

      <div className={tabVisible("stats")}>
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
          </div>
        </ManagerSectionCard>
      )}

      {fixture.meta?.liveEvents && fixture.meta.liveEvents.length > 0 && (
        <>
          <div className="sm:hidden">
            <CollapsibleDetails summary="Match Events">
              <ul className="divide-y divide-pitch-700/30">
                {[...fixture.meta.liveEvents].reverse().map((ev, i) => (
                  <ManagerMatchEventLine
                    key={`${ev.minute}-${i}`}
                    event={ev}
                    userClub={career.club}
                    opponentClub={fixture.opponent}
                    className="py-1.5"
                  />
                ))}
              </ul>
            </CollapsibleDetails>
          </div>
          <div className={`hidden sm:block ${CARD.base} ${SPACING.cardPadding}`}>
            <p className={TYPO.sectionLabel}>Match Events</p>
            <ul className="mt-2 divide-y divide-pitch-700/30">
              {[...fixture.meta.liveEvents].reverse().map((ev, i) => (
                <ManagerMatchEventLine
                  key={`${ev.minute}-${i}`}
                  event={ev}
                  userClub={career.club}
                  opponentClub={fixture.opponent}
                  className="py-1.5"
                />
              ))}
            </ul>
          </div>
        </>
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

      <MatchReviewBackBar onClose={onClose} />
      </div>
      </ManagerSection>
    </ManagerPage>
  );
}
