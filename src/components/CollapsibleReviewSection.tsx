"use client";

import { memo, useCallback, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { GamePanel } from "@/components/ui/GamePanel";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose, playPanelExpand } from "@/lib/sound";

export interface CollapsibleReviewSectionProps {
  title: string;
  helper?: string;
  delay?: number;
  defaultOpen?: boolean;
  variant?: "default" | "featured";
  children: ReactNode;
}

/**
 * Season / cup review accordion. Uses CSS grid row animation so nested
 * expansions (Quick Mode match reviews) can grow the section without being
 * clipped by a fixed Framer Motion height + overflow:hidden.
 */
export const CollapsibleReviewSection = memo(function CollapsibleReviewSection({
  title,
  helper,
  delay = 0,
  defaultOpen = true,
  variant = "default",
  children,
}: CollapsibleReviewSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setOpen((v) => {
      if (v) playPanelClose();
      else playPanelExpand();
      return !v;
    });
  }, []);

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
        className={featured ? "" : "p-4"}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-3 text-left transition hover:opacity-90"
        >
          <motion.span
            className="shrink-0 text-sm text-theme-primary"
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            aria-hidden
          >
            ▶
          </motion.span>
          <h3 className={`min-w-0 flex-1 ${titleClass}`}>{title}</h3>
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className={open ? "min-h-0 overflow-visible" : "min-h-0 overflow-hidden"}>
            <div
              className={
                featured
                  ? SPACING.sectionContentTopFeatured
                  : SPACING.sectionContentTop
              }
              aria-hidden={!open}
            >
              {helper && (
                <p className={`${SPACING.headingMargin} ${TYPO.bodySm}`}>
                  {helper}
                </p>
              )}
              {children}
            </div>
          </div>
        </div>
      </GamePanel>
    </motion.div>
  );
});
