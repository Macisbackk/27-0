"use client";

import {
  nestedTabGroupButtonClass,
  nestedTabGroupClass,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playEraModeOff, playEraModeOn } from "@/lib/sound";

interface ChallengeCupVariantToggleProps {
  eraMode: boolean;
  className?: string;
  /** Buttons update variant preference (sidebar, home). Required for toggle behaviour. */
  onEraModeChange: (eraMode: boolean) => void;
  /** Sidebar: compact nested toggle with shorter labels. */
  compact?: boolean;
  /** Sidebar: omit the section label to save vertical space. */
  hideLabel?: boolean;
  /** Section label above toggle — e.g. "Mode" or "Cup Mode". */
  sectionLabel?: string;
}

export function ChallengeCupVariantToggle({
  eraMode,
  className = "",
  onEraModeChange,
  compact = false,
  hideLabel = false,
  sectionLabel = "Cup Mode",
}: ChallengeCupVariantToggleProps) {
  const currentClass = compact
    ? nestedTabGroupButtonClass(!eraMode, "normal")
    : tabGroupButtonClass(!eraMode, "normal");
  const eraClass = compact
    ? nestedTabGroupButtonClass(eraMode, "era")
    : tabGroupButtonClass(eraMode, "era");
  const groupClass = compact
    ? nestedTabGroupClass(false, !eraMode, eraMode)
    : tabGroupClass(false, !eraMode, eraMode);

  const currentLabel = compact ? "Current" : "Current Teams";
  const eraLabel = compact ? "Era" : "Era Teams";

  return (
    <div className={className}>
      {!hideLabel && (
        <p
          className={`mb-1.5 ${compact ? "px-1" : "text-center"} ${TYPO.sectionLabel}`}
        >
          {sectionLabel}
        </p>
      )}
      <div className={groupClass}>
        <button
          type="button"
          onClick={() => {
            if (!eraMode) return;
            playEraModeOff();
            onEraModeChange(false);
          }}
          className={currentClass}
        >
          {currentLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (eraMode) return;
            playEraModeOn();
            onEraModeChange(true);
          }}
          className={eraClass}
        >
          {eraLabel}
        </button>
      </div>
    </div>
  );
}
