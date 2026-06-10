"use client";

import { memo, useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface CollapsibleReviewSectionProps {
  title: string;
  delay?: number;
  defaultOpen?: boolean;
  variant?: "default" | "featured";
  children: ReactNode;
}

export const CollapsibleReviewSection = memo(function CollapsibleReviewSection({
  title,
  delay = 0,
  defaultOpen = true,
  variant = "default",
  children,
}: CollapsibleReviewSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const panelClass =
    variant === "featured"
      ? "mt-6 w-full max-w-3xl matchday-panel border border-accent-green/15 p-4 shadow-[0_0_32px_rgba(34,197,94,0.06)] sm:p-6"
      : "mt-6 w-full max-w-2xl matchday-panel p-4";

  const titleClass =
    variant === "featured"
      ? "font-display text-base font-bold uppercase tracking-wider text-accent-green sm:text-lg"
      : "font-display text-sm font-bold uppercase tracking-wider text-accent-green";

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
            <div className={variant === "featured" ? "pt-5" : "pt-4"}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});
