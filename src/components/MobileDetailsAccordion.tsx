"use client";

import { useState, type ReactNode } from "react";
import { playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface MobileDetailsAccordionProps {
  title: string;
  children: ReactNode;
  /** When true, section starts expanded on mobile. */
  defaultOpen?: boolean;
}

/** Collapsible wrapper for secondary hub sections on small screens; always open on sm+. */
export function MobileDetailsAccordion({
  title,
  children,
  defaultOpen = false,
}: MobileDetailsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <div className="sm:hidden">
        <div className={`${CARD.base} ${SPACING.cardPaddingSm}`}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={open}
            onClick={() => {
              playUiClick();
              setOpen((v) => !v);
            }}
          >
            <p className={TYPO.sectionLabel}>{title}</p>
            <span
              className={`shrink-0 text-sm text-theme-primary transition ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            >
              ▼
            </span>
          </button>
          {open && <div className="mt-4 space-y-4">{children}</div>}
        </div>
      </div>
      <div className="hidden space-y-4 sm:block">{children}</div>
    </>
  );
}
