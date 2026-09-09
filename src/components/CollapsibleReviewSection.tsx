"use client";

import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { GamePanel } from "@/components/ui/GamePanel";
import { SPACING } from "@/lib/ui/design-system";
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
 */
export const CollapsibleReviewSection = memo(function CollapsibleReviewSection({
  title,
  helper,
  delay = 0,
  variant = "default",
  children,
}: CollapsibleReviewSectionProps) {
  const featured = variant === "featured";
  const titleClass = featured
    ? `${TYPO.sectionTitle} text-theme-primary`
    : TYPO.sectionTitle;

  return (
    <motion.div
      className={`${SPACING.sectionGap} w-full max-w-none`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <GamePanel
        as="section"
        variant={featured ? "featured" : "elevated"}
        padded={featured}
        className={featured ? "" : "p-3 sm:p-4"}
      >
        <div className="w-full text-center">
          <h3 className={`min-w-0 ${titleClass}`}>{title}</h3>
        </div>

        <div
          className={
            featured
              ? SPACING.sectionContentTopFeatured
              : SPACING.sectionContentTop
          }
        >
          {helper && (
            <p
              className={`${SPACING.headingMargin} text-center ${TYPO.bodySm}`}
            >
              {helper}
            </p>
          )}
          {children}
        </div>
      </GamePanel>
    </motion.div>
  );
});
