"use client";

import type { ReactNode } from "react";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SectionCardProps {
  title?: string;
  helper?: string;
  featured?: boolean;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  helper,
  featured = false,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`${CARD.hero} ${featured ? CARD.featured : ""} ${SPACING.cardPadding} ${className}`}
    >
      {title && (
        <header className={SPACING.headingMargin}>
          <h3 className={TYPO.sectionTitle}>{title}</h3>
          {helper && <p className={`mt-1 ${TYPO.bodySm}`}>{helper}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
