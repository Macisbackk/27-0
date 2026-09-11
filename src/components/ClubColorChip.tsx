"use client";

import type { UiSurface } from "@/lib/ui/surfaces";
import { ClubNameLabel } from "./ClubNameLabel";

interface ClubColorChipProps {
  name: string;
  primary: string;
  secondary: string;
  accent?: string;
  compact?: boolean;
  align?: "left" | "right";
  surface?: UiSurface;
  /** When false, skip the left/right club colour border strip. */
  showAccent?: boolean;
  /** Compact abbreviation badge above the name — off by default for denser rows. */
  showAbbreviation?: boolean;
}

/** Fixture/results club chip with dual-colour swatch. */
export function ClubColorChip({
  name,
  compact,
  align = "left",
  surface = "resultRow",
  showAccent = true,
  showAbbreviation = false,
}: ClubColorChipProps) {
  return (
    <ClubNameLabel
      club={name}
      variant="row"
      compact={compact}
      showAbbreviation={showAbbreviation}
      align={align}
      surface={surface}
      showAccent={showAccent}
      className={`min-w-0 flex-1 ${
        compact ? "gap-1.5 [&_p]:line-clamp-1 [&_p]:leading-tight" : ""
      }`}
    />
  );
}
