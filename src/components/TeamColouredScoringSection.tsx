import type { ReactNode } from "react";
import { getClubColors } from "@/lib/clubs";
import { CARD, SPACING } from "@/lib/ui/design-system";

interface TeamColouredScoringSectionProps {
  colorClub: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Team scoring block — matches page stat cards, with a thin club accent. */
export function TeamColouredScoringSection({
  colorClub,
  children,
  className = "",
  compact = false,
}: TeamColouredScoringSectionProps) {
  const colors = getClubColors(colorClub);
  const pad = compact ? "px-2.5 py-2" : SPACING.cardPaddingSm;

  return (
    <div
      className={`${CARD.stat} ${pad} ${className}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: colors.primary,
      }}
    >
      {children}
    </div>
  );
}
