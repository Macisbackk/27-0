"use client";

import Link from "next/link";
import { buildPlayHref } from "@/lib/play-links";
import {
  nestedTabGroupButtonClass,
  nestedTabGroupClass,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface ChallengeCupVariantToggleProps {
  eraMode: boolean;
  className?: string;
  /** Home page: buttons update state; play/sidebar: links navigate between variants. */
  onEraModeChange?: (eraMode: boolean) => void;
  /** Sidebar: compact nested toggle with shorter labels. */
  compact?: boolean;
  onNavigate?: () => void;
}

export function ChallengeCupVariantToggle({
  eraMode,
  className = "",
  onEraModeChange,
  compact = false,
  onNavigate,
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
      <p
        className={`mb-1.5 ${compact ? "px-1" : "text-center"} ${TYPO.sectionLabel}`}
      >
        Cup Mode
      </p>
      <div className={groupClass}>
        {onEraModeChange ? (
          <>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onEraModeChange(false);
              }}
              className={currentClass}
            >
              {currentLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onEraModeChange(true);
              }}
              className={eraClass}
            >
              {eraLabel}
            </button>
          </>
        ) : (
          <>
            <Link
              href={buildPlayHref("cup", "NORMAL", false)}
              onClick={() => {
                playUiClick();
                onNavigate?.();
              }}
              className={currentClass}
            >
              {currentLabel}
            </Link>
            <Link
              href={buildPlayHref("cup", "NORMAL", true)}
              onClick={() => {
                playUiClick();
                onNavigate?.();
              }}
              className={eraClass}
            >
              {eraLabel}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
