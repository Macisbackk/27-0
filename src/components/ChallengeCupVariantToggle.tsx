"use client";

import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { playEraModeOff, playEraModeOn } from "@/lib/sound";

type CupVariantId = "current" | "era";

interface ChallengeCupVariantToggleProps {
  eraMode: boolean;
  className?: string;
  /** Buttons update variant preference (sidebar, home). Required for toggle behaviour. */
  onEraModeChange: (eraMode: boolean) => void;
  /** Sidebar: compact nested toggle with shorter labels. */
  compact?: boolean;
  /** Use "Current" / "Era" labels (matches Challenge Cup home toggle). */
  useShortLabels?: boolean;
  /** Sidebar: omit the section label to save vertical space. */
  hideLabel?: boolean;
  /** Section label above toggle — e.g. "Mode" or "Cup Mode". */
  sectionLabel?: string;
}

/**
 * Compact centred Current / Era control.
 * Era selected = mode gold only; Current selected = mode green; idle = neutral.
 */
export function ChallengeCupVariantToggle({
  eraMode,
  className = "",
  onEraModeChange,
  compact = false,
  useShortLabels = false,
  hideLabel = false,
  sectionLabel = "Cup Mode",
}: ChallengeCupVariantToggleProps) {
  const currentLabel =
    useShortLabels || compact ? "Current" : "Current Teams";
  const eraLabel = useShortLabels || compact ? "Era" : "Era Teams";

  const handleChange = (id: CupVariantId) => {
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
