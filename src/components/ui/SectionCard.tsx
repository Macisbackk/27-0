"use client";

import type { ReactNode } from "react";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameSectionTitle } from "@/components/ui/GameSectionTitle";
import { SPACING } from "@/lib/ui/design-system";
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
    <GamePanel
      as="section"
      variant={featured ? "featured" : "elevated"}
      padded
      className={className}
    >
      {title ? (
        <header className={SPACING.headingMargin}>
          <GameSectionTitle heading={title} />
          {helper ? <p className={`mt-1 ${TYPO.bodySm}`}>{helper}</p> : null}
        </header>
      ) : null}
      {children}
    </GamePanel>
  );
}
