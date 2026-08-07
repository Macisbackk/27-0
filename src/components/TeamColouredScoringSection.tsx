import type { CSSProperties, ReactNode } from "react";
import { getClubEventPanelAccent } from "@/lib/clubs";
import { CARD, SPACING } from "@/lib/ui/design-system";

interface TeamColouredScoringSectionProps {
  colorClub: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Team scoring block — neutral game-stat-card with a thin club **secondary**
 * top accent (no Store theme-primary strip).
 */
export function TeamColouredScoringSection({
  colorClub,
  children,
  className = "",
  compact = false,
}: TeamColouredScoringSectionProps) {
  const accent = getClubEventPanelAccent(colorClub, "secondary");
  const pad = compact ? "px-2.5 py-2" : SPACING.cardPaddingSm;
  const style: CSSProperties = {
    borderTopWidth: 2,
    borderTopStyle: "solid",
    borderTopColor: accent,
  };

  return (
    <div
      className={`${CARD.stat} game-stat-card--neutral ${pad} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
