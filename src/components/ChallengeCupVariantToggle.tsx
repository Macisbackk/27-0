"use client";

import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import {
  nestedTabGroupButtonClass,
  nestedTabGroupClass,
} from "@/lib/ui/design-system";
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

  const tabs = [
    { id: "current" as const, label: currentLabel, variant: "normal" as const },
    { id: "era" as const, label: eraLabel, variant: "era" as const },
  ];

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
      className={`${compact ? "" : "flex flex-col items-stretch"} ${className}`}
    >
      {!hideLabel && (
        <p
          className={`mb-1.5 w-full ${compact ? "px-1" : ""} ${TYPO.sectionLabel}`}
        >
          {sectionLabel}
        </p>
      )}
      {compact ? (
        <div className={nestedTabGroupClass(false, !eraMode, eraMode)}>
          <button
            type="button"
            onClick={() => handleChange("current")}
            className={nestedTabGroupButtonClass(!eraMode, "normal")}
          >
            {currentLabel}
          </button>
          <button
            type="button"
            onClick={() => handleChange("era")}
            className={nestedTabGroupButtonClass(eraMode, "era")}
          >
            {eraLabel}
          </button>
        </div>
      ) : (
        <ManagerSubTabBar
          tabs={tabs}
          active={eraMode ? "era" : "current"}
          onChange={handleChange}
          eraAccent={eraMode}
          ariaLabel={sectionLabel}
        />
      )}
    </div>
  );
}
