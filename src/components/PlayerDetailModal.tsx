"use client";

import type { Player } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { getDreamTeamYears, getPlayerAchievements } from "@/lib/players/achievements";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { RLTag, ACHIEVEMENT_TAG_VARIANT } from "./cards/rl-card";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
}

export function PlayerDetailModal({ player, onClose }: PlayerDetailModalProps) {
  const achievements = getPlayerAchievements(player);
  const dreamTeamYears = getDreamTeamYears(player.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name} player details`}
      onClick={onClose}
    >
      <div
        className={`card-glass max-h-[92vh] w-full max-w-lg overflow-y-auto ${SPACING.cardPadding} animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className={TYPO.sectionLabel}>Player Details</p>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        <RugbyLeaguePlayerCard player={player} variant="default" equalHeight />

        {achievements.length > 0 && (
          <div className={`mt-4 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={`${TYPO.sectionTitle} mb-2`}>Achievements</p>
            <div className="flex flex-wrap gap-1.5">
              {achievements.map((achievement) => (
                <RLTag
                  key={achievement.label}
                  variant={ACHIEVEMENT_TAG_VARIANT[achievement.color]}
                >
                  {achievement.label}
                </RLTag>
              ))}
            </div>
          </div>
        )}

        {dreamTeamYears.length > 0 && (
          <div className={`mt-3 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={TYPO.statLabel}>Dream Team</p>
            <p className={`mt-1 ${TYPO.body}`}>{dreamTeamYears.join(", ")}</p>
          </div>
        )}

        <div className={`mt-3 grid grid-cols-2 gap-2 ${TYPO.bodySm}`}>
          <div className={CARD.inset}>
            <p className={TYPO.statLabel}>Peak Rating</p>
            <p className="mt-0.5 font-semibold text-accent-green">
              {player.peakRating}
            </p>
          </div>
          <div className={CARD.inset}>
            <p className={TYPO.statLabel}>Value</p>
            <p className="mt-0.5 font-semibold text-accent-gold">
              {formatValue(player.value)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
