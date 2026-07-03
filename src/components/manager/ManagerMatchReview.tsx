"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BracketRecap } from "@/components/BracketRecap";
import { MatchDetailsPanel } from "@/components/MatchDetailsPanel";
import { MatchPlayerOfTheMatchCard } from "@/components/MatchPlayerOfTheMatchCard";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING, TAB_RAIL } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { buildSquadSlotsFromMatchday } from "@/lib/manager/managerSquad";
import { formatWage } from "@/lib/manager/managerContracts";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import { ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import {
  getManagerCupRoundLabel,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";
import {
  managerCompetitionSurfaceClass,
  managerInsetPanelClass,
} from "@/lib/manager/managerSurfaces";
import { playUiClick } from "@/lib/sound";
import {
  cupRoundKeyToBracketRound,
  snapshotCupBracketAtRound,
} from "@/lib/manager/managerChallengeCup";
import {
  getManagerMatchKeyMoment,
  type MatchKeyMomentTone,
} from "@/lib/manager/managerMatchMoments";

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

  const fixture =
    career.fixtures.find((f) => f.fixtureId === fixtureId) ??
    career.fixtures.find((f) => `round-${f.round}` === fixtureId) ??
    (career.lastMatchFixture &&
    (career.lastMatchFixture.fixtureId === fixtureId ||
      `round-${career.lastMatchFixture.round}` === fixtureId)
      ? career.lastMatchFixture
      : undefined);

  if (!fixture) {
    return (
      <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
        <div className={`${CARD.elevated} ${SPACING.cardPaddingMobile} text-center space-y-4`}>
          <h1 className={TYPO.viewTitle}>Match not found</h1>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            This result could not be loaded from your save.
          </p>
          <GameButton onClick={() => { playUiClick(); onClose(); }}>
            ← Back
          </GameButton>
        </div>
      </div>
    );
  }

  const squad = buildSquadSlotsFromMatchday(
    fixture.meta?.matchdayXiii ?? career.matchdayXiii,
    fixture.meta?.xiiiSlotPositions ?? career.xiiiSlotPositions,
    career
  );
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
    gold: "border-accent-gold/40 bg-accent-gold/10 text-accent-gold",
    primary: "border-theme-primary/40 bg-theme-primary/10 text-theme-primary",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    muted: "border-pitch-600/50 bg-pitch-800/40 text-pitch-300",
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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <GameButton
          variant="secondary"
          fullWidth={false}
          size="sm"
          onClick={() => {
            playUiClick();
            onClose();
          }}
        >
          ← Back
        </GameButton>
      </div>

      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} text-center ${
          isChallengeCupFixture(fixture.competition)
            ? managerCompetitionSurfaceClass("challenge_cup")
            : fixture.competition === "playoffs"
              ? managerCompetitionSurfaceClass("playoffs")
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

      <div className={`${TAB_RAIL.outer} sm:hidden`}>
        <div className={`${TAB_RAIL.inner} gap-1.5`}>
          {(
            [
              ["story", "Story"],
              ["stats", "Stats"],
              ...(hasTactics ? ([["tactics", "Tactics"]] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                playUiClick();
                setMobileTab(id);
              }}
              className={`${TAB_RAIL.item} min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold ${
                mobileTab === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
              <li key={`${ev.minute}-${i}`} className={`${TYPO.bodySm}`}>
                {ev.description}
              </li>
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
    </div>
  );
}
