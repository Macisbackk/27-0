"use client";

import Link from "next/link";
import { buildPlayHref } from "@/lib/play-links";
import {
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface ChallengeCupVariantToggleProps {
  eraMode: boolean;
  className?: string;
  /** Home page: buttons update state; play page: links navigate between variants. */
  onEraModeChange?: (eraMode: boolean) => void;
}

export function ChallengeCupVariantToggle({
  eraMode,
  className = "",
  onEraModeChange,
}: ChallengeCupVariantToggleProps) {
  const currentClass = tabGroupButtonClass(!eraMode, "normal");
  const eraClass = tabGroupButtonClass(eraMode, "era");

  return (
    <div className={className}>
      <p className={`mb-2 text-center ${TYPO.sectionLabel}`}>Cup Mode</p>
      <div className={tabGroupClass(false, !eraMode, eraMode)}>
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
              Current Teams
            </button>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onEraModeChange(true);
              }}
              className={eraClass}
            >
              Era Teams
            </button>
          </>
        ) : (
          <>
            <Link
              href={buildPlayHref("cup", "NORMAL", false)}
              onClick={() => playUiClick()}
              className={currentClass}
            >
              Current Teams
            </Link>
            <Link
              href={buildPlayHref("cup", "NORMAL", true)}
              onClick={() => playUiClick()}
              className={eraClass}
            >
              Era Teams
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
