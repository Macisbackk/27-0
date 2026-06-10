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
}

/** Fixture/results club chip with dual-colour swatch. */
export function ClubColorChip({
  name,
  compact,
  align = "left",
  surface = "resultRow",
}: ClubColorChipProps) {
  return (
    <ClubNameLabel
      club={name}
      variant="row"
      compact={compact}
      showAbbreviation={compact}
      align={align}
      surface={surface}
      className="flex-1"
    />
  );
}
