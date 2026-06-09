"use client";

import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES, type UiSurface } from "@/lib/ui/surfaces";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface ClubColorChipProps {
  name: string;
  primary: string;
  secondary: string;
  accent?: string;
  compact?: boolean;
  align?: "left" | "right";
  /** Panel behind the team name — text contrast is computed from this, not club colours. */
  surface?: UiSurface;
}

/** Fixture/results club chip with dual-colour swatch. */
export function ClubColorChip({
  name,
  primary,
  secondary,
  accent,
  compact,
  align = "left",
  surface = "resultRow",
}: ClubColorChipProps) {
  const isRight = align === "right";
  const textColor = getReadableTextColor(UI_SURFACES[surface]);

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        isRight ? "flex-row-reverse justify-start text-right" : "justify-end"
      }`}
    >
      <ClubDualSwatch
        club={name}
        primary={primary}
        secondary={secondary}
        size={compact ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`fixture-team-name min-w-0 break-words font-semibold leading-snug ${
            compact ? "text-xs" : "text-sm"
          }`}
          style={{ color: textColor }}
        >
          {name}
        </p>
      </div>
    </div>
  );
}
