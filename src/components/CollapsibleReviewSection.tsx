"use client";

import { memo, useState, type ReactNode } from "react";
import { playUiClick } from "@/lib/sound";
import { motion } from "framer-motion";
import { GamePanel } from "@/components/ui/GamePanel";
import { TYPO } from "@/lib/ui/typography";

export interface CollapsibleReviewSectionProps {
  title: string;
  helper?: string;
  delay?: number;
  variant?: "default" | "featured";
  /** Start folded with a "Show" toggle: for the long detail (full table, every result). */
  collapsed?: boolean;
  children: ReactNode;
}

/**
 * Season / cup review section. Open by default so review pages flow as a single scroll; the
 * long detail sections (full table, every result) start folded so the result hits first.
 *
 * Floodlights card: borderless surface (`game-panel`), one heading style, and
 * no outer margin — the review page column owns the gap between cards.
 */
export const CollapsibleReviewSection = memo(function CollapsibleReviewSection({
  title,
  helper,
  delay = 0,
  variant = "default",
  collapsed = false,
  children,
}: CollapsibleReviewSectionProps) {
  const featured = variant === "featured";
  const [open, setOpen] = useState(!collapsed);

  return (
    <motion.div
      className="w-full min-w-0 max-w-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <GamePanel as="section" className="p-4 sm:p-5">
        {collapsed ? (
          <button
            type="button"
            className={`relative flex w-full min-w-0 items-center justify-center px-16 text-center ${TYPO.cardHeading} ${featured ? "!text-theme-primary" : ""}`}
            aria-expanded={open}
            onClick={() => {
              playUiClick();
              setOpen((o) => !o);
            }}
          >
            <span className="min-w-0 truncate">{title}</span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0 rounded-full bg-pitch-800 px-3 py-1 text-xs font-bold text-[color:var(--fl-muted)]">{open ? "Hide" : "Show"}</span>
          </button>
        ) : (
          <h3
            className={`min-w-0 text-center ${TYPO.cardHeading} ${
              featured ? "!text-theme-primary" : ""
            }`}
          >
            {title}
          </h3>
        )}

        {open ? (
          <div className="mt-3 sm:mt-4">
            {helper && (
              <p className={`mb-3 text-center ${TYPO.label}`}>{helper}</p>
            )}
            {children}
          </div>
        ) : null}
      </GamePanel>
    </motion.div>
  );
});
