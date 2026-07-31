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
}

/** Fixture/results club chip with dual-colour swatch. */
export function ClubColorChip({
  name,
  compact,
  align = "left",
  surface = "resultRow",
  showAccent = true,
}: ClubColorChipProps) {
  return (
    <ClubNameLabel
      club={name}
      variant="row"
      compact={compact}
      showAbbreviation={compact}
      align={align}
      surface={surface}
      showAccent={showAccent}
      className="flex-1"
    />
  );
}
