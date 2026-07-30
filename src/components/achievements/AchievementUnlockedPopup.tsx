"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameButton } from "@/components/ui/GameButton";
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

  return (
    <AnimatePresence>
      <motion.div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
      >
        <GamePanel
          padded
          className="pointer-events-auto w-full max-w-md shadow-2xl"
          aria-label="Achievement unlocked"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Achievement Unlocked
              </p>
              <p className="mt-1 font-display text-lg font-bold text-white">
                {definition.name}
              </p>
              <p className="mt-1 text-sm text-pitch-200">
                {definition.description}
              </p>
              {rewardAmount && rewardAmount > 0 ? (
                <p className="mt-2 text-sm font-semibold text-accent-gold">
                  +{formatClubFunds(rewardAmount)} Club Funds
                </p>
              ) : null}
            </div>
            <GameButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="shrink-0"
            >
              Dismiss
            </GameButton>
          </div>
        </GamePanel>
      </motion.div>
    </AnimatePresence>
  );
}
