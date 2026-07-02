"use client";

import { GameButton } from "@/components/ui/GameButton";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import {
  ManagerDeltaBadge,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";

interface ManagerDevelopmentReviewProps {
  career: ManagerCareer;
  onContinue: () => void;
}

export function ManagerDevelopmentReview({
  career,
  onContinue,
}: ManagerDevelopmentReviewProps) {
  const changes = career.lastSeasonDevelopmentReview ?? [];
  const improved = changes.filter((c) => c.delta > 0);
  const declined = changes.filter((c) => c.delta < 0);

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <ManagerSectionCard variant="featured">
        <p className={`${TYPO.sectionLabel} text-center`}>Potential Review</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
          How your squad developed over the season
        </p>
      </ManagerSectionCard>

      {changes.length === 0 ? (
        <ManagerSectionCard>
          <p className={TYPO.bodySm}>
            No major rating changes this season — most players held steady.
          </p>
        </ManagerSectionCard>
      ) : (
        <>
          {improved.length > 0 && (
            <ManagerSectionCard title="Improved" accent="primary">
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {improved.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm} flex flex-wrap items-baseline gap-1`}>
                    <span className="font-semibold text-white">{c.playerName}</span>
                    <span className="text-pitch-500">
                      {c.before} → <span className="text-theme-primary font-semibold">{c.after}</span>
                    </span>
                    <ManagerDeltaBadge delta={c.delta} />
                    <span className="text-pitch-500">· POT {c.potential}</span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}
          {declined.length > 0 && (
            <ManagerSectionCard title="Declined" accent="red">
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {declined.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm} flex flex-wrap items-baseline gap-1`}>
                    <span className="font-semibold text-white">{c.playerName}</span>
                    <span className="text-pitch-500">
                      {c.before} → <span className="text-red-300 font-semibold">{c.after}</span>
                    </span>
                    <ManagerDeltaBadge delta={c.delta} />
                    <span className="text-pitch-500">· POT {c.potential}</span>
                  </li>
                ))}
              </ul>
            </ManagerSectionCard>
          )}
        </>
      )}

      <GameButton
        variant="theme"
        onClick={() => {
          playUiClick();
          onContinue();
        }}
      >
        Continue to Rewards
      </GameButton>
    </div>
  );
}
