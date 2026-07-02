import type { ReactNode } from "react";
import { getClubColors } from "@/lib/clubs";
import { SPACING } from "@/lib/ui/design-system";

interface TeamColouredScoringSectionProps {
  colorClub: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Subtle team-tinted container for tries / kicking blocks in match details. */
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
      className={`rounded-lg border border-pitch-700/40 ${pad} ${className}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: colors.primary,
        background: `linear-gradient(90deg, ${colors.primary}14 0%, rgba(0,0,0,0.2) 52%)`,
      }}
    >
      {children}
    </div>
  );
}
