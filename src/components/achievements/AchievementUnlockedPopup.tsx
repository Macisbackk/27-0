"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import { GameBadge } from "@/components/ui/GameBadge";
import type { AchievementUnlockResult } from "@/lib/achievements/achievementEngine";
import { formatClubFunds } from "@/lib/club-funds";

interface AchievementUnlockedPopupProps {
  result: AchievementUnlockResult;
  onDismiss: () => void;
}

export function AchievementUnlockedPopup({
  result,
  onDismiss,
}: AchievementUnlockedPopupProps) {
  const { definition, rewardAmount } = result;
  const titleId = `achievement-popup-title-${result.id}`;

  return (
    <BodyPortal>
      <AnimatePresence>
        <motion.div
          key={result.id}
          className="achievement-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
        >
          <motion.div
            className="achievement-popup-card"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            <GameBadge tone="theme" className="achievement-popup-kicker">
              Achievement Unlocked
            </GameBadge>
            <h2 id={titleId} className="achievement-popup-title">
              {definition.name}
            </h2>
            <p className="achievement-popup-description">
              {definition.description}
            </p>
            {rewardAmount && rewardAmount > 0 ? (
              <div className="achievement-popup-reward">
                Reward: {formatClubFunds(rewardAmount)} Club Funds
              </div>
            ) : null}
            <GameButton
              type="button"
              variant="theme"
              size="md"
              fullWidth={false}
              onClick={onDismiss}
              className="achievement-popup-button"
            >
              Continue
            </GameButton>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </BodyPortal>
  );
}
