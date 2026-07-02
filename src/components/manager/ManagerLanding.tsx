"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  playSeasonStart,
  playUiClick,
} from "@/lib/sound";

interface ManagerLandingProps {
  hasSave: boolean;
  onStartNew: () => void;
  onContinue: () => void;
  onDelete: () => void;
}

export function ManagerLanding({
  hasSave,
  onStartNew,
  onContinue,
  onDelete,
}: ManagerLandingProps) {
  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <div className={`${CARD.hero} ${CARD.featured} ${SPACING.cardPaddingLg} text-center`}>
        <p className={TYPO.sectionLabel}>Career Mode</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>Manager Mode</h1>
        <p className={`mt-3 ${TYPO.body} text-pitch-300`}>
          Take charge of a{" "}
          <span className="font-semibold text-theme-primary">Super League</span>{" "}
          club.
        </p>
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
          <span className="text-accent-gold">Squad</span>
          <span className="text-pitch-600"> · </span>
          <span className="text-sky-300">Tactics</span>
          <span className="text-pitch-600"> · </span>
          <span className="text-theme-primary">Form</span>
          <span className="text-pitch-600"> · </span>
          <span className="text-accent-gold">Trophies</span>
        </p>
      </div>

      <div className={SPACING.stackMd}>
        <GameButton
          variant="theme"
          onClick={() => {
            playSeasonStart();
            playUiClick();
            onStartNew();
          }}
        >
          Start New Career
        </GameButton>

        {hasSave && (
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onContinue();
            }}
          >
            Continue Career
          </GameButton>
        )}

        {hasSave && (
          <GameButton
            variant="danger"
            onClick={() => {
              playUiClick();
              onDelete();
            }}
          >
            Delete Career
          </GameButton>
        )}
      </div>
    </div>
  );
}
