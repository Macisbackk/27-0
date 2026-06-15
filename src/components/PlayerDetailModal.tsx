"use client";

import type { Player } from "@/lib/types";
import { formatPlayerDisplayName, formatPlayerAge, formatValue } from "@/lib/players";
import { getGoldenBootYears } from "@/lib/players/achievements";
import { getCachedPlayerAchievements } from "@/lib/players/achievement-cache";
import { AchievementChipList } from "./cards/AchievementChipList";
import { RugbyLeaguePlayerCard } from "./cards/RugbyLeaguePlayerCard";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
}

export function PlayerDetailModal({ player, onClose }: PlayerDetailModalProps) {
  const achievements = getCachedPlayerAchievements(player, "expanded");
  const goldenBootYears = getGoldenBootYears(player.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${formatPlayerDisplayName(player)} player details`}
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

        <RugbyLeaguePlayerCard
          player={player}
          variant="default"
          equalHeight
          achievementDisplay="expanded"
        />

        {achievements.length > 0 && (
          <div className={`mt-4 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={`${TYPO.sectionTitle} mb-2`}>Achievements</p>
            <AchievementChipList
              achievements={achievements}
              dreamTeamDefaultExpanded
            />
          </div>
        )}

        {goldenBootYears.length > 0 && (
          <div className={`mt-3 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={TYPO.statLabel}>Golden Boot</p>
            <p className={`mt-1 ${TYPO.body}`}>{goldenBootYears.join(", ")}</p>
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
          <div className={CARD.inset}>
            <p className={TYPO.statLabel}>Age</p>
            <p className="mt-0.5 font-medium text-white">
              {formatPlayerAge(player)}
            </p>
          </div>
          <div className={`${CARD.inset} col-span-2`}>
            <p className={TYPO.statLabel}>Years Active</p>
            <p className="mt-0.5 font-medium text-white">{player.yearsActive}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
