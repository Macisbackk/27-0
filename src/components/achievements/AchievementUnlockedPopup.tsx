"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import { GameBadge } from "@/components/ui/GameBadge";
import type { AchievementUnlockResult } from "@/lib/achievements/achievementEngine";
import { formatClubFunds } from "@/lib/club-funds";

/** Prevents the opening pointer event from instantly dismissing the overlay. */
const OVERLAY_ARM_MS = 280;

interface AchievementUnlockedPopupProps {
  result: AchievementUnlockResult | null;
  onDismiss: () => void;
}

export function AchievementUnlockedPopup({
  result,
  onDismiss,
}: AchievementUnlockedPopupProps) {
  const [overlayArmed, setOverlayArmed] = useState(false);
  const shownIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!result) {
      setOverlayArmed(false);
      shownIdRef.current = null;
      return;
    }
    if (shownIdRef.current === result.id) return;
    shownIdRef.current = result.id;
    setOverlayArmed(false);
    const timer = window.setTimeout(() => setOverlayArmed(true), OVERLAY_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [result]);

  const titleId = result
    ? `achievement-popup-title-${result.id}`
    : "achievement-popup-title";

  return (
    <BodyPortal>
      <AnimatePresence>
        {result ? (
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
            onClick={() => {
              if (!overlayArmed) return;
              onDismiss();
            }}
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
                {result.definition.name}
              </h2>
              <p className="achievement-popup-description">
                {result.definition.description}
              </p>
              {result.rewardAmount && result.rewardAmount > 0 ? (
                <div className="achievement-popup-reward">
                  Reward: {formatClubFunds(result.rewardAmount)} Club Funds
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
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
