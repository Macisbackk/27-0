"use client";

import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { playUiClick } from "@/lib/sound";

interface ManagerFixturesProps {
  career: ManagerCareer;
  onSelectFixture: (round: number) => void;
}

export function ManagerFixtures({
  career,
  onSelectFixture,
}: ManagerFixturesProps) {
  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <h1 className={TYPO.pageTitle}>Fixtures</h1>

      <div className={`${CARD.base} ${SPACING.cardPadding} ${SPACING.stackSm}`}>
        {career.schedule.map((sched) => {
          const played = career.fixtures.find((f) => f.round === sched.round);
          if (played) {
            return (
              <FixtureResultRow
                key={sched.round}
                fixture={played}
                userTeamName={career.club}
                onClick={() => {
                  playUiClick();
                  onSelectFixture(sched.round);
                }}
              />
            );
          }
          return (
            <div
              key={sched.round}
              className={`${CARD.inset} flex items-center justify-between px-3 py-2`}
            >
              <span className={`${TYPO.bodySm}`}>
                R{sched.round} {sched.isHome ? "vs" : "@"} {sched.opponent}
              </span>
              <span className={`${TYPO.bodySm} text-pitch-500`}>Upcoming</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
