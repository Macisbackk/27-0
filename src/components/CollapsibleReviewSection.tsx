"use client";

import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { GamePanel } from "@/components/ui/GamePanel";
import { TYPO } from "@/lib/ui/typography";

export interface CollapsibleReviewSectionProps {
  title: string;
  helper?: string;
  delay?: number;
  variant?: "default" | "featured";
  children: ReactNode;
}

/**
 * Season / cup review section. Kept always open so review pages flow as a
 * single scroll without accordion stops, especially on mobile.
 *
 * Floodlights card: borderless surface (`game-panel`), one heading style, and
 * no outer margin — the review page column owns the gap between cards.
 */
export const CollapsibleReviewSection = memo(function CollapsibleReviewSection({
  title,
  helper,
  delay = 0,
  variant = "default",
  children,
}: CollapsibleReviewSectionProps) {
  const featured = variant === "featured";

  return (
    <motion.div
      className="w-full min-w-0 max-w-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <GamePanel as="section" className="p-4 sm:p-5">
        <h3
          className={`min-w-0 text-center ${TYPO.cardHeading} ${
            featured ? "!text-theme-primary" : ""
          }`}
        >
          {title}
        </h3>

        <div className="mt-3 sm:mt-4">
          {helper && (
            <p className={`mb-3 text-center ${TYPO.label}`}>{helper}</p>
          )}
          {children}
        </div>
      </GamePanel>
    </motion.div>
  );
});
