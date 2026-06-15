"use client";

import { memo, useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CARD, SPACING } from "@/lib/ui/design-system";
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

  const panelClass =
    variant === "featured"
      ? `${SPACING.sectionGap} w-full max-w-3xl matchday-panel ${CARD.base} ${CARD.featured} ${SPACING.cardPadding}`
      : `${SPACING.sectionGap} w-full max-w-2xl matchday-panel ${CARD.base} p-4`;

  const titleClass =
    variant === "featured"
      ? "font-display text-base font-bold uppercase tracking-wider text-accent-green sm:text-lg"
      : TYPO.sectionTitle;

  return (
    <motion.section
      className={panelClass}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left transition hover:opacity-90"
      >
        <motion.span
          className="shrink-0 text-sm text-accent-green"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          aria-hidden
        >
          ▶
        </motion.span>
        <h3 className={`min-w-0 flex-1 ${titleClass}`}>{title}</h3>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className={
                variant === "featured"
                  ? SPACING.sectionContentTopFeatured
                  : SPACING.sectionContentTop
              }
            >
              {helper && (
                <p className={`${SPACING.headingMargin} ${TYPO.bodySm}`}>
                  {helper}
                </p>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});
