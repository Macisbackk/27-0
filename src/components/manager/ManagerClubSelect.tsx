"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getAllManagerClubConfigs } from "@/lib/manager/club-config";
import { playUiClick } from "@/lib/sound";

interface ManagerClubSelectProps {
  onSelect: (club: string) => void;
  onBack: () => void;
}

export function ManagerClubSelect({ onSelect, onBack }: ManagerClubSelectProps) {
  const clubs = getAllManagerClubConfigs();

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Choose Your Club</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Select a Super League club to manage.
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${SPACING.cardGridGap}`}>
        {clubs.map((club) => (
          <button
            key={club.name}
            type="button"
            onClick={() => {
              playUiClick();
              onSelect(club.name);
            }}
            className={`${CARD.base} ${CARD.interactive} ${SPACING.cardPaddingSm} text-left`}
          >
            <div className="flex items-start gap-3">
              <div
                className="h-10 w-10 shrink-0 rounded-lg border border-pitch-600/50"
                style={{
                  background: `linear-gradient(135deg, ${club.primaryColor} 50%, ${club.secondaryColor} 50%)`,
                }}
              />
              <div className="min-w-0 flex-1">
                <p className={`${TYPO.cardTitle} truncate`}>{club.name}</p>
                <p className={`${TYPO.bodySm} text-pitch-400`}>
                  {club.expectation}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-pitch-300">
                  <span>Rating {club.squadRating}</span>
                  <span>Budget £{(club.budget / 1000).toFixed(0)}k</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <GameButton variant="secondary" onClick={onBack} fullWidth={false}>
        Back
      </GameButton>
    </div>
  );
}
