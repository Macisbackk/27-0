"use client";

import type { ReactNode } from "react";
import { GamePanel } from "@/components/ui/GamePanel";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SectionCardProps {
  title?: string;
  helper?: string;
  featured?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Site-page section panel — same elevated GamePanel + centred section title
 * language as CollapsibleReviewSection (Season Review).
 */
export function SectionCard({
  title,
  helper,
  featured = false,
  children,
  className = "",
}: SectionCardProps) {
  const titleClass = featured
    ? `${TYPO.sectionTitle} text-theme-primary`
    : TYPO.sectionTitle;

  return (
    <GamePanel
      as="section"
      variant={featured ? "featured" : "elevated"}
      className={`p-3 sm:p-4 ${className}`.trim()}
    >
      {title ? (
        <header className="w-full text-center">
          <h3 className={`min-w-0 ${titleClass}`}>{title}</h3>
          {helper ? (
            <p className={`mt-1 ${TYPO.bodySm}`}>{helper}</p>
          ) : null}
        </header>
      ) : null}
      <div
        className={
          title
            ? featured
              ? SPACING.sectionContentTopFeatured
              : SPACING.sectionContentTop
            : undefined
        }
      >
        {children}
      </div>
    </GamePanel>
  );
}
