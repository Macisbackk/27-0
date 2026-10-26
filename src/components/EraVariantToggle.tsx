"use client";

import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { playEraModeOff, playEraModeOn } from "@/lib/sound";

type EraVariantId = "current" | "era";

interface EraVariantToggleProps {
  eraMode: boolean;
  className?: string;
  /** Buttons update variant preference (sidebar, home). Required for toggle behaviour. */
  onEraModeChange: (eraMode: boolean) => void;
  /** Sidebar: compact nested toggle with shorter labels. */
  compact?: boolean;
  /** @deprecated Labels are always "Classic" / "Era Classic" now. */
  useShortLabels?: boolean;
  /** Sidebar: omit the section label to save vertical space. */
  hideLabel?: boolean;
  /** Section label above toggle — e.g. "Mode Variant". */
  sectionLabel?: string;
}

/**
 * Compact centred Classic / Era Classic control.
 * Era selected = mode gold only; Current selected = mode green; idle = neutral.
 */
export function EraVariantToggle({
  eraMode,
  className = "",
  onEraModeChange,
  compact = false,
  hideLabel = false,
  sectionLabel = "Mode",
}: EraVariantToggleProps) {
  // One vocabulary everywhere (home, menu, page titles, stats, boards): Classic = this
  // season's squads, Era Classic = every era. The short/compact flags are kept for callers.
  const currentLabel = "Classic";
  const eraLabel = "Era Classic";

  const handleChange = (id: EraVariantId) => {
    if (id === "era" && !eraMode) {
      playEraModeOn();
      onEraModeChange(true);
      return;
    }
    if (id === "current" && eraMode) {
      playEraModeOff();
      onEraModeChange(false);
    }
  };

  return (
    <GameSegmentedControl
      className={className}
      compact={compact}
      label={hideLabel ? undefined : sectionLabel}
      ariaLabel={sectionLabel}
      value={eraMode ? "era" : "current"}
      onChange={handleChange}
      options={[
        { id: "current", label: currentLabel, tone: "current" },
        { id: "era", label: eraLabel, tone: "era" },
      ]}
    />
  );
}

/** @deprecated Use EraVariantToggle */
export const ChallengeCupVariantToggle = EraVariantToggle;
