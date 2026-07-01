"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

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
      <div className={`${CARD.elevated} ${SPACING.cardPaddingLg} text-center`}>
        <p className={TYPO.sectionLabel}>Potential Review</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>
          {career.club} · {career.seasonYear}
        </h1>
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
          How your squad developed over the season
        </p>
      </div>

      {changes.length === 0 ? (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.bodySm}>
            No major rating changes this season — most players held steady.
          </p>
        </div>
      ) : (
        <>
          {improved.length > 0 && (
            <div className={`${CARD.base} ${SPACING.cardPadding}`}>
              <p className={TYPO.sectionLabel}>Improved</p>
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {improved.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm}`}>
                    <span className="font-medium text-white">{c.playerName}</span>
                    <span className="text-pitch-400">
                      {" "}
                      {c.before} → {c.after} ({c.delta > 0 ? "+" : ""}
                      {c.delta}) · POT {c.potential}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {declined.length > 0 && (
            <div className={`${CARD.base} ${SPACING.cardPadding}`}>
              <p className={TYPO.sectionLabel}>Declined</p>
              <ul className={`mt-2 ${SPACING.stackSm}`}>
                {declined.map((c) => (
                  <li key={c.playerId} className={`${TYPO.bodySm}`}>
                    <span className="font-medium text-white">{c.playerName}</span>
                    <span className="text-pitch-400">
                      {" "}
                      {c.before} → {c.after} ({c.delta}) · POT {c.potential}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
