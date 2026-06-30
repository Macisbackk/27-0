"use client";

import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { buildMergedDisplaySchedule } from "@/lib/manager/managerChallengeCup";
import { playUiClick } from "@/lib/sound";

interface ManagerFixturesProps {
  career: ManagerCareer;
  onSelectFixture: (fixtureId: string) => void;
}

export function ManagerFixtures({
  career,
  onSelectFixture,
}: ManagerFixturesProps) {
  const displaySchedule = buildMergedDisplaySchedule(career);

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <h1 className={TYPO.pageTitle}>Fixtures</h1>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackSm}`}>
        {displaySchedule.map((sched) => {
          const played = career.fixtures.find(
            (f) =>
              f.fixtureId === sched.id ||
              (f.round === sched.round &&
                f.competition === sched.competition &&
                f.opponent === sched.opponent)
          );
          if (played) {
            return (
              <FixtureResultRow
                key={sched.id}
                fixture={played}
                userTeamName={career.club}
                onClick={() => {
                  playUiClick();
                  onSelectFixture(
                    played.fixtureId ?? sched.id
                  );
                }}
              />
            );
          }
          if (sched.competition === "challenge_cup") {
            const cupDone = career.fixtures.some(
              (f) =>
                f.competition === "challenge_cup" &&
                f.meta?.cupRound === sched.cupRound
            );
            if (cupDone || career.challengeCup.userEliminated) return null;
          }
          return (
            <div
              key={sched.id}
              className={`${CARD.inset} flex items-center justify-between px-3 py-2`}
            >
              <span className={`${TYPO.bodySm}`}>
                {sched.label ??
                  `${sched.isHome ? "vs" : "@"} ${sched.opponent}`}
              </span>
              <span className={`${TYPO.bodySm} text-pitch-500`}>Upcoming</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
