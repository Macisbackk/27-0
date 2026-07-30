"use client";

import { TYPO } from "@/lib/ui/typography";
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
 * Compact Current / Era segmented control.
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
    <div
      className={`mode-switch-wrap ${compact ? "" : "flex w-full max-w-sm flex-col items-stretch"} ${className}`}
    >
      {!hideLabel && (
        <p
          className={`mb-1.5 w-full ${compact ? "px-1" : ""} ${TYPO.sectionLabel}`}
        >
          {sectionLabel}
        </p>
      )}
      <div
        className={
          compact
            ? "mode-switch mode-switch--sidebar"
            : "mode-switch mode-switch--home"
        }
        role="tablist"
        aria-label={sectionLabel}
      >
        <button
          type="button"
          role="tab"
          aria-selected={!eraMode}
          onClick={() => handleChange("current")}
          className={!eraMode ? "active current" : ""}
        >
          {currentLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={eraMode}
          onClick={() => handleChange("era")}
          className={eraMode ? "active era" : ""}
        >
          {eraLabel}
        </button>
      </div>
    </div>
  );
}
