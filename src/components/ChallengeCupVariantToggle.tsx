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
}

export function ChallengeCupVariantToggle({
  eraMode,
  className = "",
}: ChallengeCupVariantToggleProps) {
  return (
    <div className={className}>
      <p className={`mb-2 text-center ${TYPO.sectionLabel}`}>Cup Mode</p>
      <div className={tabGroupClass(eraMode, !eraMode)}>
        <Link
          href={buildPlayHref("cup", "NORMAL", false)}
          onClick={() => playUiClick()}
          className={tabGroupButtonClass(!eraMode, "normal")}
        >
          Current Teams
        </Link>
        <Link
          href={buildPlayHref("cup", "NORMAL", true)}
          onClick={() => playUiClick()}
          className={tabGroupButtonClass(eraMode, "hard")}
        >
          Era Mode
        </Link>
      </div>
    </div>
  );
}
